import { prefersReducedMotion } from './motion.ts';

/** The header's motion, on the transitions.dev scale attentionawareness and Agent Caffeine share. */
const duration = {
  quick: '150ms',
  slow: '400ms',
  stagger: '40ms',
  verySlow: '500ms',
} as const;
const easing = { inOut: 'ease-in-out', smoothOut: 'cubic-bezier(0.22, 1, 0.36, 1)' } as const;
const blur = { small: '2px' } as const;

/**
 * One layout gathering into another: the header's open strip into its pill
 * and back. `update` changes the layout at once; the items marked
 * `data-morph` inside `root` then move from where they stood to where they
 * now stand, and `surface`, the ground drawn behind them, grows or shrinks
 * from its old box to its new one.
 *
 * Ported from attentionawareness's header. The motion follows the transitions.dev scale. Gathering into the pill is
 * the surface opening: it takes `verySlow`, and the items set off a
 * `stagger` apart, in the order they stand. Opening back out is the close:
 * quicker, at `slow`, and all at once. Both travel on `smoothOut`. An item
 * with no place on the other side is a word going or coming: it fades out
 * and blurs at `quick` as the motion starts, or fades in from a blur at
 * `quick` as it ends, so it never stands under an item passing it.
 *
 * Where the browser has view transitions, the items are carried by one; each
 * `data-morph` is also its `view-transition-name`. Elsewhere they are moved
 * by hand, and an item that is gone leaves a copy where it stood to fade.
 * The surface is not a snapshot in either case: it stays live, so the page
 * blurs through it the whole way. With less motion, the layout only changes.
 *
 * An item that changes shape between the two layouts is passed as `live` and
 * is no snapshot either. A view transition can only fade one picture of an
 * item into another, and a square fading into a circle reads as a blink, not
 * as a change of shape. A live item is moved and resized by hand instead, as
 * the surface is, and its corners go from the old radius to the new one over
 * the same motion, so it is one shape the whole way.
 *
 * A view transition eases each step of its own keyframes as well, which on
 * top of the pace hurries the items. Gathering, that brings them in ahead of
 * the surface closing around them. Opening back out it would fling them past
 * the surface's edges before it has opened, and leave the surface sweeping
 * out after they have stopped. So that transition is given a type, and
 * `app.css` takes the ease off by it: the pace is then the whole motion, as
 * it is for the surface. There every picture also holds its last frame until
 * the transition is gone, so the live items take over exactly as they stand.
 */
type Timing = { delay?: number; duration: number; easing: string; fill?: FillMode };

const QUICK = Number.parseFloat(duration.quick);
const STAGGER = Number.parseFloat(duration.stagger);
/** A word leaving or arriving, out of focus on the side where it is not. */
const WORD_GONE = { filter: `blur(${blur.small})`, opacity: 0 };
const WORD_HERE = { filter: 'blur(0)', opacity: 1 };
/** The type of a view transition that opens the items back out. */
const SPREADING = 'morph-spreading';

type Box = { opacity: string; radius: string; rect: DOMRect };
/** A live item before the change: where it stood and how round its corners were. */
type Shape = { radius: string; rect: DOMRect };
/**
 * A marked item before the change: where it stood, its parent, and a copy of
 * it as it was drawn then, to leave in its place if it goes.
 */
type Item = { copy: HTMLElement; parent: HTMLElement | null; rect: DOMRect };
/**
 * How long the items travel, how far apart they set off, and whether, carried
 * by a view transition, they run ahead of the surface.
 */
type Pace = { ahead: boolean; length: number; stagger: number };

/** Gathering into the pill, the surface opening. */
const GATHER: Pace = {
  ahead: true,
  length: Number.parseFloat(duration.verySlow),
  stagger: STAGGER,
};
/** Opening back out, the surface closing. */
const SPREAD: Pace = { ahead: false, length: Number.parseFloat(duration.slow), stagger: 0 };

function travel(pace: Pace, index: number): Timing {
  return {
    delay: index * pace.stagger,
    duration: pace.length,
    easing: easing.smoothOut,
    fill: 'backwards',
  };
}

function leave(): Timing {
  return { duration: QUICK, easing: easing.inOut, fill: 'forwards' };
}

function arrive(pace: Pace): Timing {
  return { delay: pace.length - QUICK, duration: QUICK, easing: easing.inOut, fill: 'backwards' };
}

/** Where `element` is drawn now, motion included, and its running motion stopped. */
function settle(element: HTMLElement): DOMRect {
  const rect = element.getBoundingClientRect();
  for (const animation of element.getAnimations()) {
    animation.cancel();
  }
  return rect;
}

function surfaceBox(surface: HTMLElement): Box {
  const style = getComputedStyle(surface);
  const box = {
    opacity: style.opacity,
    radius: style.borderRadius,
    rect: surface.getBoundingClientRect(),
  };
  settle(surface);
  return box;
}

/** The surface from its old box to the one its container gives it now. */
function growSurface(surface: HTMLElement, from: Box, pace: Pace) {
  const to = surface.getBoundingClientRect();
  const style = getComputedStyle(surface);
  surface.animate(
    [
      {
        borderRadius: from.radius,
        bottom: `${to.bottom - from.rect.bottom}px`,
        left: `${from.rect.left - to.left}px`,
        opacity: from.opacity,
        right: `${to.right - from.rect.right}px`,
        top: `${from.rect.top - to.top}px`,
      },
      {
        borderRadius: style.borderRadius,
        bottom: '0px',
        left: '0px',
        opacity: style.opacity,
        right: '0px',
        top: '0px',
      },
    ],
    travel(pace, 0),
  );
}

/** Where a live item is drawn now and how round, motion included, and its running motion stopped. */
function shapeOf(element: HTMLElement): Shape {
  const { borderRadius } = getComputedStyle(element);
  return { radius: borderRadius, rect: settle(element) };
}

/**
 * A live item from its old box and corners to the ones the layout gives it
 * now. `ahead` is for one carried beside the pictures of a view transition
 * that run ahead of the surface, under the browser's own ease: it keeps
 * their pace, under the same ease.
 */
function reshape(element: HTMLElement, from: Shape, pace: Pace, ahead: boolean) {
  const to = element.getBoundingClientRect();
  if (to.width === 0 || to.height === 0) {
    return;
  }
  element.animate(
    [
      {
        borderRadius: from.radius,
        easing: ahead ? 'ease' : 'linear',
        transform: `translate(${from.rect.left - to.left}px, ${from.rect.top - to.top}px) scale(${from.rect.width / to.width}, ${from.rect.height / to.height})`,
        transformOrigin: '0 0',
      },
      {
        borderRadius: getComputedStyle(element).borderRadius,
        transform: 'none',
        transformOrigin: '0 0',
      },
    ],
    travel(pace, 0),
  );
}

/** The marked items in the order they stand, by name. */
function marked(root: HTMLElement): Map<string, HTMLElement> {
  const items = new Map<string, HTMLElement>();
  for (const element of root.querySelectorAll<HTMLElement>('[data-morph]')) {
    const name = element.dataset.morph;
    if (name !== undefined && element.getBoundingClientRect().width > 0) {
      items.set(name, element);
    }
  }
  return items;
}

/** The copy of `item` where it stood, fading out of focus, then gone. */
function fadeOut(item: Item) {
  const ghost = item.copy;
  ghost.removeAttribute('data-morph');
  ghost.setAttribute('aria-hidden', 'true');
  ghost.inert = true;
  Object.assign(ghost.style, {
    boxSizing: 'border-box',
    height: `${item.rect.height}px`,
    left: `${item.rect.left}px`,
    margin: '0',
    pointerEvents: 'none',
    position: 'fixed',
    top: `${item.rect.top}px`,
    width: `${item.rect.width}px`,
  });
  // In its old parent where that is still there, so it keeps the type it
  // inherited.
  (item.parent?.isConnected ? item.parent : document.body).append(ghost);
  const fade = ghost.animate([WORD_HERE, WORD_GONE], leave());
  void fade.finished.finally(() => ghost.remove()).catch(() => {});
}

/** The marked items from their old boxes to their new ones, by hand. */
function slide(root: HTMLElement, before: Map<string, Item>, order: Array<string>, pace: Pace) {
  for (const [name, element] of marked(root)) {
    const old = before.get(name);
    before.delete(name);
    if (old === undefined) {
      element.animate([WORD_GONE, WORD_HERE], arrive(pace));
      continue;
    }
    const rect = element.getBoundingClientRect();
    element.animate(
      [
        {
          transform: `translate(${old.rect.left - rect.left}px, ${old.rect.top - rect.top}px) scale(${old.rect.width / rect.width}, ${old.rect.height / rect.height})`,
          transformOrigin: '0 0',
        },
        { transform: 'none', transformOrigin: '0 0' },
      ],
      travel(pace, order.indexOf(name)),
    );
  }
  for (const old of before.values()) {
    fadeOut(old);
  }
}

/** Only a keyframe effect names a pseudo-element. */
function isKeyframeEffect(effect: AnimationEffect | null): effect is KeyframeEffect {
  return effect !== null && 'pseudoElement' in effect;
}

/** The view transition's own motion, set to the page's pace. */
function retime(order: Array<string>, pace: Pace) {
  const pictures = document.getAnimations().flatMap(({ effect }) => {
    if (!isKeyframeEffect(effect)) {
      return [];
    }
    const match = /^::view-transition-(group|old|new)\((.+)\)$/.exec(effect.pseudoElement ?? '');
    return match?.[1] === undefined || match[2] === undefined
      ? []
      : [{ effect, name: match[2], side: match[1] }];
  });
  const sides = new Set(pictures.map(({ name, side }) => `${side} ${name}`));
  for (const { effect, name, side } of pictures) {
    if (side === 'old' && !sides.has(`new ${name}`)) {
      effect.setKeyframes([WORD_HERE, WORD_GONE]);
      effect.updateTiming(leave());
    } else if (side === 'new' && !sides.has(`old ${name}`)) {
      effect.setKeyframes([WORD_GONE, WORD_HERE]);
      effect.updateTiming(arrive(pace));
    } else {
      const timing = travel(pace, order.indexOf(name));
      effect.updateTiming(pace.ahead ? timing : { ...timing, fill: 'both' });
    }
  }
}

/**
 * Changes the layout with `update` and moves the items from the old one to
 * the new one: gathering when `gather` is true, spreading back out when not.
 */
export function morph({
  gather,
  live = [],
  root,
  surface,
  update,
}: {
  gather: boolean;
  /** The items that change shape, carried live and not as pictures. */
  live?: ReadonlyArray<HTMLElement>;
  root: HTMLElement;
  surface: HTMLElement;
  update: () => void;
}) {
  if (prefersReducedMotion()) {
    update();
    return;
  }
  const pace = gather ? GATHER : SPREAD;
  const from = surfaceBox(surface);
  const shapes = live.map((element) => ({ element, from: shapeOf(element) }));
  const reshapeLive = (ahead: boolean) => {
    for (const shape of shapes) {
      reshape(shape.element, shape.from, pace, ahead);
    }
  };
  const standing = marked(root);
  const orderAfter = () => [...new Set([...standing.keys(), ...marked(root).keys()])];

  if (typeof document.startViewTransition === 'function') {
    const transition = document.startViewTransition(update);
    // A browser that has no types yet keeps its own ease under the pace.
    if (!pace.ahead && 'types' in transition) {
      transition.types.add(SPREADING);
    }
    // `ready` rejects when a newer transition cuts this one short, and then
    // there is nothing left to time or grow.
    transition.ready.then(() => retime(orderAfter(), pace)).catch(() => {});
    transition.updateCallbackDone
      .then(() => {
        growSurface(surface, from, pace);
        reshapeLive(pace.ahead);
      })
      .catch(() => {});
    return;
  }

  const before = new Map<string, Item>();
  for (const [name, element] of standing) {
    before.set(name, {
      copy: document.importNode(element, true),
      parent: element.parentElement,
      rect: settle(element),
    });
  }
  update();
  const order = orderAfter();
  slide(root, before, order, pace);
  growSurface(surface, from, pace);
  reshapeLive(false);
}
