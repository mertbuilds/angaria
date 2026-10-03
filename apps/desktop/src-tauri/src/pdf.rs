//! The e-Arşiv PDF: GİB's invoice page (scripts already stripped, QR code
//! drawn in) printed by an off-screen WebKit view with JavaScript off. The
//! page is laid out 840 CSS px wide, as in the app's preview, and zoomed to
//! A4's width; a page longer than A4 stays one tall page.

use std::time::Duration;

/// Off-screen WebKit hands the PDF back well within this.
const TIMEOUT: Duration = Duration::from_secs(30);

#[tauri::command]
pub async fn html_to_pdf(
  app: tauri::AppHandle,
  html: String,
) -> Result<tauri::ipc::Response, String> {
  #[cfg(target_os = "macos")]
  {
    let (sender, receiver) = tokio::sync::oneshot::channel();
    app
      .run_on_main_thread(move || {
        macos::render(
          &html,
          Box::new(move |result| {
            let _ = sender.send(result);
          }),
        )
      })
      .map_err(|error| error.to_string())?;
    let pdf = tokio::time::timeout(TIMEOUT, receiver)
      .await
      .map_err(|_| "PDF rendering timed out".to_string())?
      .map_err(|_| "PDF rendering stopped".to_string())??;
    Ok(tauri::ipc::Response::new(pdf))
  }
  #[cfg(not(target_os = "macos"))]
  {
    let _ = (app, html);
    Err("PDF rendering needs macOS".into())
  }
}

#[cfg(target_os = "macos")]
pub mod macos {
  use std::cell::{Cell, RefCell};

  use block2::RcBlock;
  use objc2::{
    define_class, msg_send,
    rc::Retained,
    runtime::{AnyObject, NSObject, ProtocolObject},
    DefinedClass, MainThreadMarker, MainThreadOnly, Message,
  };
  use objc2_core_foundation::{CGPoint, CGRect, CGSize};
  use objc2_foundation::{NSData, NSError, NSNumber, NSObjectProtocol, NSString};
  use objc2_web_kit::{
    WKNavigation, WKNavigationDelegate, WKPDFConfiguration, WKWebView, WKWebViewConfiguration,
  };

  /// A4 in PDF points.
  const PAGE_WIDTH: f64 = 595.0;
  const PAGE_HEIGHT: f64 = 842.0;
  /// The width GİB's page is laid out at: the preview's, 800 px of page and its margins.
  const LAYOUT_WIDTH: f64 = 840.0;

  pub type Done = Box<dyn FnOnce(Result<Vec<u8>, String>)>;

  pub struct Ivars {
    done: Cell<Option<Done>>,
    webview: RefCell<Option<Retained<WKWebView>>>,
  }

  thread_local! {
    /// Renders in flight: WebKit holds its navigation delegate weakly.
    static RENDERS: RefCell<Vec<Retained<Render>>> = const { RefCell::new(Vec::new()) };
  }

  define_class!(
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[ivars = Ivars]
    pub struct Render;

    unsafe impl NSObjectProtocol for Render {}

    unsafe impl WKNavigationDelegate for Render {
      #[unsafe(method(webView:didFinishNavigation:))]
      fn did_finish(&self, webview: &WKWebView, _navigation: Option<&WKNavigation>) {
        self.measure(webview);
      }

      #[unsafe(method(webView:didFailNavigation:withError:))]
      fn did_fail(&self, _webview: &WKWebView, _navigation: Option<&WKNavigation>, error: &NSError) {
        self.finish(Err(error.localizedDescription().to_string()));
      }

      #[unsafe(method(webView:didFailProvisionalNavigation:withError:))]
      fn did_fail_provisional(
        &self,
        _webview: &WKWebView,
        _navigation: Option<&WKNavigation>,
        error: &NSError,
      ) {
        self.finish(Err(error.localizedDescription().to_string()));
      }
    }
  );

  impl Render {
    /// The page's height, so the PDF holds all of it and nothing past its width.
    fn measure(&self, webview: &WKWebView) {
      let this = self.retain();
      let view = webview.retain();
      let measured = RcBlock::new(move |value: *mut AnyObject, _error: *mut NSError| {
        // SAFETY: WebKit hands a number (or nil) for a numeric expression.
        let height = unsafe { value.cast::<NSNumber>().as_ref() }.map_or(0.0, |n| n.doubleValue());
        this.print(&view, height);
      });
      // SAFETY: called on the main thread with a block of the documented signature.
      unsafe {
        webview.evaluateJavaScript_completionHandler(
          &NSString::from_str("document.documentElement.scrollHeight"),
          Some(&measured),
        );
      }
    }

    fn print(&self, webview: &WKWebView, layout_height: f64) {
      let zoom = PAGE_WIDTH / LAYOUT_WIDTH;
      let mtm = self.mtm();
      // SAFETY: main thread; WKPDFConfiguration is a plain value object.
      let configuration = unsafe { WKPDFConfiguration::new(mtm) };
      unsafe {
        configuration.setRect(CGRect::new(
          CGPoint::new(0.0, 0.0),
          CGSize::new(PAGE_WIDTH, PAGE_HEIGHT.max((layout_height * zoom).ceil())),
        ));
      }
      let this = self.retain();
      let printed = RcBlock::new(move |data: *mut NSData, error: *mut NSError| {
        // SAFETY: WebKit hands either the PDF or an error.
        let result = match unsafe { (data.as_ref(), error.as_ref()) } {
          (Some(data), _) => Ok(data.to_vec()),
          (None, Some(error)) => Err(error.localizedDescription().to_string()),
          (None, None) => Err("WebKit returned no PDF".to_string()),
        };
        this.finish(result);
      });
      // SAFETY: called on the main thread with a block of the documented signature.
      unsafe { webview.createPDFWithConfiguration_completionHandler(Some(&configuration), &printed) };
    }

    fn finish(&self, result: Result<Vec<u8>, String>) {
      // Alive until this returns, though RENDERS lets go of it below.
      let _render = self.retain();
      if let Some(done) = self.ivars().done.take() {
        done(result);
      }
      self.ivars().webview.borrow_mut().take();
      RENDERS.with(|renders| renders.borrow_mut().retain(|render| !std::ptr::eq(&**render, self)));
    }
  }

  /// Starts a render on the main thread; `done` gets the PDF or WebKit's error.
  pub fn render(html: &str, done: Done) {
    let Some(mtm) = MainThreadMarker::new() else {
      done(Err("PDF rendering must start on the main thread".into()));
      return;
    };
    // SAFETY: main thread; standard WebKit setup on fresh objects.
    unsafe {
      let configuration = WKWebViewConfiguration::new(mtm);
      configuration
        .defaultWebpagePreferences()
        .setAllowsContentJavaScript(false);
      let webview = WKWebView::initWithFrame_configuration(
        mtm.alloc(),
        CGRect::new(CGPoint::new(0.0, 0.0), CGSize::new(PAGE_WIDTH, PAGE_HEIGHT)),
        &configuration,
      );
      webview.setPageZoom(PAGE_WIDTH / LAYOUT_WIDTH);
      let render = mtm.alloc::<Render>().set_ivars(Ivars {
        done: Cell::new(Some(done)),
        webview: RefCell::new(Some(webview.clone())),
      });
      let render: Retained<Render> = msg_send![super(render), init];
      webview.setNavigationDelegate(Some(ProtocolObject::from_ref(&*render)));
      RENDERS.with(|renders| renders.borrow_mut().push(render));
      webview.loadHTMLString_baseURL(&NSString::from_str(html), None);
    }
  }
}
