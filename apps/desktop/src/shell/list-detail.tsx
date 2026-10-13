import { create, props } from '@stylexjs/stylex';
import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';
import { tones } from './palette.stylex.ts';

const KEYBOARD_STEP = 16;

/** The detail pane keeps this much of a narrow window; the list gives way down to its minimum. */
const MIN_DETAIL_WIDTH = 240;

const styles = create({
  detail: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
    minWidth: 0,
    overflowY: 'auto',
  },
  handle: {
    '::before': {
      content: '',
      insetBlock: 0,
      insetInline: '-3px',
      position: 'absolute',
    },
    backgroundColor: {
      ':focus-visible': tones.ring,
      default: tones.divider,
    },
    // Focused, the 1px line widens to 3px, so it reads as focus.
    boxShadow: {
      ':focus-visible': `0 0 0 1px ${tones.ring}`,
      default: 'none',
    },
    cursor: 'col-resize',
    flexShrink: 0,
    outline: 'none',
    position: 'relative',
    touchAction: 'none',
    width: '1px',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    minHeight: 0,
    overflowY: 'auto',
  },
  listWidth: (width: number, minWidth: number) => ({
    maxWidth: `max(${minWidth}px, calc(100% - ${MIN_DETAIL_WIDTH}px))`,
    width: `${width}px`,
  }),
  root: {
    display: 'flex',
    flex: 1,
    minHeight: 0,
    minWidth: 0,
  },
});

function readWidth(storageKey: string | undefined) {
  if (!storageKey) {
    return null;
  }
  try {
    const value = Number(localStorage.getItem(storageKey));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function writeWidth(storageKey: string | undefined, width: number) {
  if (!storageKey) {
    return;
  }
  try {
    localStorage.setItem(storageKey, String(width));
  } catch {
    // Width memory is a convenience; the default applies next time.
  }
}

export interface ListDetailProps {
  /** Starting list width in pixels. Default 320. */
  defaultListWidth?: number;
  /** The right pane, usually the child route's <Outlet />. Scrolls on its own. */
  detail: ReactNode;
  /** The left pane. Scrolls on its own. */
  list: ReactNode;
  /** Default 480. */
  maxListWidth?: number;
  /** Default 240. */
  minListWidth?: number;
  /** Remembers the dragged width in localStorage under this key. */
  storageKey?: string;
}

/**
 * A list column and a detail pane, split by a 1px divider. Drag the divider
 * (or focus it and use the arrow keys) to resize the list.
 */
export function ListDetail({
  defaultListWidth = 320,
  detail,
  list,
  maxListWidth = 480,
  minListWidth = 240,
  storageKey,
}: ListDetailProps) {
  const [width, setWidth] = useState(() =>
    Math.min(maxListWidth, Math.max(minListWidth, readWidth(storageKey) ?? defaultListWidth)),
  );
  const drag = useRef<{ startWidth: number; startX: number } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  // The split's own width: a narrow window keeps the detail its minimum, as the CSS does.
  const [room, setRoom] = useState<number | null>(null);

  useLayoutEffect(() => {
    const element = root.current;
    if (!element) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => setRoom(entry.contentRect.width));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const limit =
    room === null
      ? maxListWidth
      : Math.min(maxListWidth, Math.max(minListWidth, room - MIN_DETAIL_WIDTH));
  const clamp = (value: number) => Math.min(limit, Math.max(minListWidth, value));
  // The width on screen: the saved one, unless the window has no room for it.
  const shown = clamp(width);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { startWidth: shown, startX: event.clientX };
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current) {
      setWidth(clamp(drag.current.startWidth + event.clientX - drag.current.startX));
    }
  };

  const onPointerEnd = () => {
    if (drag.current) {
      drag.current = null;
      writeWidth(storageKey, shown);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === 'ArrowLeft' ? -KEYBOARD_STEP : event.key === 'ArrowRight' ? KEYBOARD_STEP : 0;
    if (step !== 0) {
      event.preventDefault();
      const next = clamp(shown + step);
      setWidth(next);
      writeWidth(storageKey, next);
    }
  };

  return (
    <div ref={root} {...props(styles.root)}>
      <div {...props(styles.list, styles.listWidth(shown, minListWidth))}>{list}</div>
      <div
        aria-label="Liste genişliği"
        aria-orientation="vertical"
        aria-valuemax={limit}
        aria-valuemin={minListWidth}
        aria-valuenow={shown}
        onKeyDown={onKeyDown}
        onLostPointerCapture={onPointerEnd}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        role="separator"
        tabIndex={0}
        {...props(styles.handle)}
      />
      <div {...props(styles.detail)}>{detail}</div>
    </div>
  );
}
