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

function toggle(animations: ReadonlyArray<Animation>, play: boolean) {
  for (const animation of animations) {
    if (play) {
      animation.play();
    } else {
      animation.pause();
    }
  }
}

/**
 * Plays `loop` on the parts inside the returned ref's element, over and over,
 * while the element is on screen, and pauses it off screen. The parts' own
 * styles are the scene's last frame: with reduced motion (or no Web
 * Animations) nothing runs and that frame stays. Only transform and opacity
 * should move, so the loop runs off the main thread.
 */
export function useLoop<T extends HTMLElement>(loop: Loop) {
  const [ref, inView] = useInView<T>({ rootMargin: '0px 0px -15% 0px' });
  const animations = useRef<Array<Animation>>([]);
  const playing = useRef(false);

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
          iterations: Infinity,
        }),
      );
    });
    animations.current = created;
    // Held on the first frame until the scene comes into view.
    toggle(created, playing.current);
    return () => {
      animations.current = [];
      for (const animation of created) {
        animation.cancel();
      }
    };
  }, [loop, ref]);

  useEffect(() => {
    playing.current = inView;
    toggle(animations.current, inView);
  }, [inView]);

  return ref;
}
