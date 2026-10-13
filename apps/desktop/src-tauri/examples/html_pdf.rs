//! The e-Arşiv PDF without the app window (macOS): renders an HTML file the
//! way Faturalar' e-Arşiv PDF does (src/pdf.rs), to check its output.
//!
//!   html_pdf <page.html> <out.pdf>

fn main() {
  #[cfg(target_os = "macos")]
  {
    use std::cell::RefCell;
    use std::rc::Rc;

    use objc2_foundation::{NSDate, NSRunLoop};

    let mut args = std::env::args().skip(1);
    let (Some(input), Some(output)) = (args.next(), args.next()) else {
      eprintln!("usage: html_pdf <page.html> <out.pdf>");
      std::process::exit(2);
    };
    let html = std::fs::read_to_string(input).expect("readable HTML file");
    let result = Rc::new(RefCell::new(None));
    let slot = Rc::clone(&result);
    angaria_lib::pdf::macos::render(&html, Box::new(move |pdf| *slot.borrow_mut() = Some(pdf)));
    let run_loop = NSRunLoop::mainRunLoop();
    while result.borrow().is_none() {
      run_loop.runUntilDate(&NSDate::dateWithTimeIntervalSinceNow(0.05));
    }
    let pdf = result.take().expect("a result").expect("a PDF");
    std::fs::write(output, pdf).expect("writable output");
  }
}
