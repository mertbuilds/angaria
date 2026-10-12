import { useEffect, useRef } from 'react';
import { prefersReducedMotion, useInView } from './motion.ts';

/** The canon's ease-out, for every segment that does not name its own. */
export const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

export type Values = Readonly<Record<string, number | string>>;

/** A part's look `at` milliseconds into the loop, and the easing on the way to its next frame. */
export type Frame = readonly [at: number, values: Values, easing?: string];

/** The frames of every element marked `data-part={part}` in the scene. */
export interface Track {
  frames: ReadonlyArray<Frame>;
  part: string;
}

/** A scene's motion: its tracks, all on one clock that restarts every `duration` milliseconds. */
export interface Loop {
  duration: number;
  /**
   * In a sequence: the moment of the scene's first full look, where it waits
   * for its turn. Each turn plays from here round the loop back to here.
   */
  poster?: number;
  tracks: ReadonlyArray<Track>;
}

/**
 * A track's frames as Web Animations keyframes. The first and last looks are
 * held out to both ends of the loop, so every part starts and ends where its
 * own frames say, never at its resting style.
 */
export function toKeyframes(frames: ReadonlyArray<Frame>, duration: number): Array<Keyframe> {
  const first = frames[0];
  const last = frames.at(-1);
  if (!first || !last) {
    return [];
  }
  const held: Array<Frame> = [
    ...(first[0] > 0 ? [[0, first[1]] as const] : []),
    ...frames,
    ...(last[0] < duration ? [[duration, last[1]] as const] : []),
  ];
  return held.map(([at, values, easing = EASE]) => ({
    ...values,
    easing,
    offset: Math.min(1, Math.max(0, at / duration)),
  }));
}

/**
 * A scene's place in a sequence: it plays once while `active`, says so with
 * `onEnd`, and waits on its first frame until its turn comes again.
 */
export interface Turn {
  active: boolean;
  onEnd: () => void;
}

function toggle(animations: ReadonlyArray<Animation>, play: boolean, rewind = false) {
  for (const animation of animations) {
    if (play) {
      animation.play();
    } else {
      animation.pause();
    }
    // After the pause: rewinding a finished animation first would start it again.
    if (rewind) {
      animation.currentTime = 0;
    }
  }
}

/**
 * Plays `loop` on the parts inside the returned ref's element, over and over,
 * while the element is on screen, and pauses it off screen. With a `turn`, it
 * plays once per turn instead, and only while it is both its turn and on
 * screen. The parts' own styles are the scene's last frame: with reduced
 * motion (or no Web Animations) nothing runs and that frame stays. Only
 * transform and opacity should move, so the loop runs off the main thread.
 */
export function useLoop<T extends HTMLElement>(loop: Loop, turn?: Turn) {
  const [ref, inView] = useInView<T>({ rootMargin: '0px 0px -15% 0px' });
  const animations = useRef<Array<Animation>>([]);
  const playing = useRef(false);
  const onEnd = useRef(turn?.onEnd);
  const once = turn !== undefined;
  const active = turn?.active ?? true;

  useEffect(() => {
    const root = ref.current;
    if (!root || prefersReducedMotion() || typeof root.animate !== 'function') {
      return;
    }
    const created = loop.tracks.flatMap(({ frames, part }) => {
      const keyframes = toKeyframes(frames, loop.duration);
      return Array.from(root.querySelectorAll<HTMLElement>(`[data-part="${part}"]`), (element) =>
        element.animate(keyframes, {
          duration: loop.duration,
          fill: 'both',
          ...(once
            ? { iterations: 1, iterationStart: (loop.poster ?? 0) / loop.duration }
            : { iterations: Infinity }),
        }),
      );
    });
    animations.current = created;
    // Every part runs on the same clock: the first one's end is the scene's.
    const [first] = created;
    if (once && first) {
      first.onfinish = () => onEnd.current?.();
    }
    // Held on the first frame until the scene comes into view.
    toggle(created, playing.current);
    return () => {
      animations.current = [];
      for (const animation of created) {
        animation.cancel();
      }
    };
  }, [loop, once, ref]);

  const end = turn?.onEnd;
  useEffect(() => {
    onEnd.current = end;
  }, [end]);

  useEffect(() => {
    playing.current = inView && active;
    toggle(animations.current, playing.current, !active);
  }, [active, inView]);

  return ref;
}
