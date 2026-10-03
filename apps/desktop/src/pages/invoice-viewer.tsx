import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
  Kbd,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@angaria/ui';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props, type StyleXStyles } from '@stylexjs/stylex';
import { Maximize2Icon, MinusIcon, PlusIcon, ScanIcon, XIcon } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  anchoredScroll,
  fitScale,
  formatZoom,
  gestureZoom,
  PAGE_MIN_HEIGHT,
  PAGE_WIDTH,
  wheelDelta,
  wheelZoom,
  zoomIn,
  zoomOut,
  zoomScale,
  type Zoom,
} from '@/lib/invoice-zoom.ts';
import { tones } from '../shell/palette.stylex.ts';

const isMac = navigator.userAgent.includes('Mac');
const mod = isMac ? '⌘' : 'Ctrl ';

const styles = create({
  // Menu and tooltip triggers carry their own data-slot, so the theme's
  // button icon size does not reach their icons.
  icon: {
    flexShrink: 0,
    height: '1rem',
    width: '1rem',
  },
  // GİB's page is paper: white, with light form controls, in both themes;
  // dark palettes dim it a little so it does not glare.
  page: {
    backgroundColor: '#ffffff',
    borderRadius: radius.base,
    boxShadow: `0 0 0 1px ${tones.paperEdge}`,
    colorScheme: 'light',
    filter: tones.paperFilter,
    flexShrink: 0,
    marginInline: 'auto',
    outline: {
      ':focus-visible': `1px solid ${tones.ring}`,
      default: 'none',
    },
    outlineOffset: '2px',
    overflow: 'hidden',
    position: 'relative',
  },
  pageOpens: {
    cursor: 'zoom-in',
  },
  pageSize: (width: number, height: number) => ({
    height: `${height}px`,
    width: `${width}px`,
  }),
  // Not interactive: the scroller takes the wheel, the pinch and the click.
  frame: {
    borderWidth: 0,
    display: 'block',
    insetBlockStart: 0,
    insetInlineStart: 0,
    pointerEvents: 'none',
    position: 'absolute',
    transformOrigin: '0 0',
  },
  frameSize: (height: number, scale: number) => ({
    height: `${height}px`,
    transform: `scale(${scale})`,
    width: `${PAGE_WIDTH}px`,
  }),
  scroller: {
    flex: 1,
    minHeight: 0,
    outline: {
      ':focus-visible': `1px solid ${tones.ring}`,
      default: 'none',
    },
    outlineOffset: '-1px',
    overflow: 'auto',
    overscrollBehavior: 'contain',
    paddingBottom: spacing.s6,
    paddingInline: spacing.s6,
    position: 'relative',
    scrollBehavior: {
      '@media (prefers-reduced-motion: reduce)': 'auto',
      default: 'smooth',
    },
    scrollbarGutter: 'stable',
  },
  // Room under the page for the floating zoom bar.
  scrollerUnderBar: {
    paddingBottom: '4.5rem',
  },
  bar: {
    alignItems: 'center',
    backgroundColor: tones.card,
    borderRadius: radius.full,
    boxShadow: `0 0 0 1px ${tones.paperEdge}, 0 4px 12px -4px rgba(0, 0, 0, 0.2)`,
    display: 'flex',
    gap: spacing.s1,
    insetBlockEnd: spacing.s4,
    insetInlineStart: '50%',
    padding: spacing.s1,
    position: 'absolute',
    transform: 'translateX(-50%)',
  },
  controls: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s1,
  },
  percent: {
    color: colors.muted,
    fontSize: font.sizeSm,
    fontVariantNumeric: 'tabular-nums',
    minWidth: '3rem',
    textAlign: 'center',
  },
  divider: {
    alignSelf: 'stretch',
    backgroundColor: tones.divider,
    marginBlock: spacing.s1,
    width: '1px',
  },
  viewer: {
    height: 'calc(100dvh - 2rem)',
    maxHeight: 'none',
    maxWidth: 'none',
    width: 'calc(100vw - 2rem)',
  },
  // The dialog's body pads by 1rem and sizes to its content.
  viewerLayout: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    height: 'calc(100dvh - 4rem)',
    minHeight: 0,
  },
  viewerBar: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  viewerTitle: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  viewerPaper: {
    backgroundColor: colors.bg,
    borderRadius: radius.base,
    paddingTop: spacing.s6,
  },
});

interface Anchor {
  pageX: number;
  pageY: number;
  x: number;
  y: number;
}

/**
 * The viewer's zoom: fit to width until the user zooms. A zoom keeps the page
 * point under the pointer (or the viewport's center) where it was.
 */
export function usePaperZoom() {
  const scroller = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState<Zoom>('fit');
  const [fit, setFit] = useState(1);
  const scale = zoomScale(zoom, fit);
  // The scale on screen, and the newest one asked for: a pinch streams
  // events faster than React renders them.
  const rendered = useRef(scale);
  const latest = useRef(scale);
  const fitRef = useRef(fit);
  const anchor = useRef<Anchor | null>(null);

  useLayoutEffect(() => {
    rendered.current = scale;
    latest.current = scale;
    fitRef.current = fit;
    const element = scroller.current;
    const sheet = page.current;
    const point = anchor.current;
    anchor.current = null;
    if (element && sheet && point) {
      element.scrollTo({
        behavior: 'instant',
        ...anchoredScroll(point, scale, { left: sheet.offsetLeft, top: sheet.offsetTop }),
      });
    }
  }, [fit, scale]);

  const zoomTo = useCallback((next: Zoom, point?: { x: number; y: number }) => {
    const nextScale = zoomScale(next, fitRef.current);
    latest.current = nextScale;
    const element = scroller.current;
    const sheet = page.current;
    if (element && sheet && nextScale !== rendered.current) {
      const x = point?.x ?? element.clientWidth / 2;
      const y = point?.y ?? element.clientHeight / 2;
      // The first event of a burst names the page point; later ones move it.
      anchor.current = anchor.current
        ? { ...anchor.current, x, y }
        : {
            pageX: (element.scrollLeft + x - sheet.offsetLeft) / rendered.current,
            pageY: (element.scrollTop + y - sheet.offsetTop) / rendered.current,
            x,
            y,
          };
    } else {
      anchor.current = null;
    }
    setZoom(next);
  }, []);

  return useMemo(
    () => ({
      fit: () => zoomTo('fit'),
      fitted: zoom === 'fit',
      in: () => zoomTo(zoomIn(zoom, fit)),
      latest,
      out: () => zoomTo(zoomOut(zoom, fit)),
      page,
      scale,
      scroller,
      setFit,
      zoomTo,
    }),
    [fit, scale, zoom, zoomTo],
  );
}

export type PaperZoom = ReturnType<typeof usePaperZoom>;

const isTyping = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return Boolean(element?.isContentEditable || element?.matches?.('input, textarea, select'));
};

/**
 * ⌘+ / ⌘= zoom in, ⌘- out, ⌘0 back to fit (Ctrl off macOS). `whileDialog`
 * says whether the keys still apply while a dialog is open: only the
 * full-screen viewer's do.
 */
export function useZoomKeys(zoom: PaperZoom, enabled: boolean, whileDialog = false) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      const modifier = isMac ? event.metaKey : event.ctrlKey;
      if (!modifier || event.altKey || event.defaultPrevented || isTyping(event.target)) {
        return;
      }
      if (!whileDialog && document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        return;
      }
      const action =
        event.key === '+' || event.key === '=' || event.code === 'NumpadAdd'
          ? zoom.in
          : event.key === '-' || event.code === 'NumpadSubtract'
            ? zoom.out
            : event.key === '0' || event.code === 'Numpad0'
              ? zoom.fit
              : null;
      if (action) {
        event.preventDefault();
        action();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [enabled, whileDialog, zoom]);
}

/**
 * GİB's page at the zoom's scale, in a scroller that takes the wheel, the
 * pinch (⌘ or Ctrl wheel, WebKit's gesture events) and, with `onOpen`, the
 * click. The HTML has no scripts (withQRCode drops them) and runs in
 * `<iframe sandbox="allow-same-origin">`: still no scripts, forms, popups or
 * navigation; same origin only so the page's height can be read.
 */
export function InvoicePaper({
  html,
  onOpen,
  style,
  zoom,
}: {
  html: string;
  onOpen?: () => void;
  style?: StyleXStyles;
  zoom: PaperZoom;
}) {
  const { latest, page, scale, scroller, setFit, zoomTo } = zoom;
  const [measured, setMeasured] = useState({ height: PAGE_MIN_HEIGHT, html });
  // A new page starts at A4's height until it has loaded and been measured.
  const height = measured.html === html ? measured.height : PAGE_MIN_HEIGHT;

  useEffect(() => {
    const element = scroller.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(() => {
      const padding = getComputedStyle(element);
      setFit(
        fitScale(
          element.clientWidth -
            Number.parseFloat(padding.paddingLeft) -
            Number.parseFloat(padding.paddingRight),
        ),
      );
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [scroller, setFit]);

  useEffect(() => {
    const element = scroller.current;
    if (!element) {
      return;
    }
    const pointer = (event: { clientX: number; clientY: number }) => {
      const box = element.getBoundingClientRect();
      return {
        x: event.clientX - box.left - element.clientLeft,
        y: event.clientY - box.top - element.clientTop,
      };
    };
    // WebKit reports a trackpad pinch as gesture events; Chromium as a Ctrl
    // wheel. Both are taken, the wheel only while no gesture runs.
    let gestureStart: number | null = null;
    const onWheel = (event: WheelEvent) => {
      if ((!event.ctrlKey && !event.metaKey) || gestureStart !== null) {
        return;
      }
      event.preventDefault();
      zoomTo(wheelZoom(latest.current, wheelDelta(event.deltaY, event.deltaMode)), pointer(event));
    };
    const onGestureStart = (event: Event) => {
      event.preventDefault();
      gestureStart = latest.current;
    };
    const onGestureChange = (event: Event) => {
      event.preventDefault();
      const gesture = event as Event & { clientX: number; clientY: number; scale: number };
      if (gestureStart !== null) {
        zoomTo(gestureZoom(gestureStart, gesture.scale), pointer(gesture));
      }
    };
    const onGestureEnd = (event: Event) => {
      event.preventDefault();
      gestureStart = null;
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('gesturestart', onGestureStart);
    element.addEventListener('gesturechange', onGestureChange);
    element.addEventListener('gestureend', onGestureEnd);
    return () => {
      element.removeEventListener('wheel', onWheel);
      element.removeEventListener('gesturestart', onGestureStart);
      element.removeEventListener('gesturechange', onGestureChange);
      element.removeEventListener('gestureend', onGestureEnd);
    };
  }, [latest, scroller, zoomTo]);

  return (
    <div ref={scroller} tabIndex={onOpen ? undefined : 0} {...props(styles.scroller, style)}>
      <div
        aria-label={onOpen ? 'Faturayı tam ekran aç' : undefined}
        onClick={onOpen}
        onKeyDown={
          onOpen
            ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onOpen();
                }
              }
            : undefined
        }
        ref={page}
        role={onOpen ? 'button' : undefined}
        tabIndex={onOpen ? 0 : undefined}
        {...props(
          styles.page,
          onOpen && styles.pageOpens,
          styles.pageSize(PAGE_WIDTH * scale, height * scale),
        )}
      >
        <iframe
          onLoad={(event) => {
            const content = event.currentTarget.contentDocument;
            if (content) {
              setMeasured({
                height: Math.max(PAGE_MIN_HEIGHT, content.documentElement.scrollHeight),
                html,
              });
            }
          }}
          sandbox="allow-same-origin"
          scrolling="no"
          srcDoc={html}
          tabIndex={-1}
          title="Fatura önizlemesi"
          {...props(styles.frame, styles.frameSize(height, scale))}
        />
      </div>
    </div>
  );
}

function ZoomButton({
  children,
  disabled,
  label,
  onClick,
  shortcut,
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  shortcut: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            aria-label={label}
            disabled={disabled}
            onClick={onClick}
            size="icon"
            variant="ghost"
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>
        {label} <Kbd>{shortcut}</Kbd>
      </TooltipContent>
    </Tooltip>
  );
}

/** − %86 + and Sığdır. */
export function ZoomControls({ zoom }: { zoom: PaperZoom }) {
  return (
    <div aria-label="Yakınlaştırma" role="group" {...props(styles.controls)}>
      <ZoomButton label="Uzaklaştır" onClick={zoom.out} shortcut={`${mod}-`}>
        <MinusIcon {...props(styles.icon)} />
      </ZoomButton>
      <span {...props(styles.percent)}>{formatZoom(zoom.scale)}</span>
      <ZoomButton label="Yakınlaştır" onClick={zoom.in} shortcut={`${mod}+`}>
        <PlusIcon {...props(styles.icon)} />
      </ZoomButton>
      <ZoomButton
        disabled={zoom.fitted}
        label="Genişliğe sığdır"
        onClick={zoom.fit}
        shortcut={`${mod}0`}
      >
        <ScanIcon {...props(styles.icon)} />
      </ZoomButton>
    </div>
  );
}

/** The pane's floating bar: zoom, then Tam ekran. */
export function PaperBar({ onOpen, zoom }: { onOpen: () => void; zoom: PaperZoom }) {
  return (
    <div {...props(styles.bar)}>
      <ZoomControls zoom={zoom} />
      <span aria-hidden {...props(styles.divider)} />
      <Tooltip>
        <TooltipTrigger render={<Button onClick={onOpen} variant="ghost" />}>
          <Maximize2Icon {...props(styles.icon)} />
          Tam ekran
        </TooltipTrigger>
        <TooltipContent>
          Tam ekran <Kbd>Boşluk</Kbd>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export const paperStyles = { underBar: styles.scrollerUnderBar };

/**
 * The invoice over the whole window, with its own zoom (fit to width first),
 * the same downloads and Esc to close.
 */
export function InvoiceViewer({
  downloads,
  html,
  onOpenChange,
  open,
  title,
}: {
  downloads?: ReactNode;
  html: string;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  title: string;
}) {
  const zoom = usePaperZoom();
  useZoomKeys(zoom, open, true);
  // The page takes the focus, so arrow keys, Page Down and Space scroll it.
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent initialFocus={zoom.scroller} showCloseButton={false} style={styles.viewer}>
        <div {...props(styles.viewerLayout)}>
          <div {...props(styles.viewerBar)}>
            <DialogTitle style={styles.viewerTitle}>{title}</DialogTitle>
            <ZoomControls zoom={zoom} />
            {downloads}
            <DialogClose render={<Button aria-label="Kapat" size="icon" variant="ghost" />}>
              <XIcon {...props(styles.icon)} />
            </DialogClose>
          </div>
          <InvoicePaper html={html} style={styles.viewerPaper} zoom={zoom} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
