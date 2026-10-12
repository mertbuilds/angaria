import { vi } from 'vitest';

/**
 * A stand-in for Element.animate, which jsdom lacks. Every call records its
 * target, keyframes and options, and returns an animation whose play, pause
 * and cancel are spies that keep `playState`; `finish` fires its `onfinish`.
 * `restore` removes it again.
 */
export function stubAnimate() {
  const animations: Array<{
    cancel: ReturnType<typeof vi.fn>;
    currentTime: number | null;
    finish: () => void;
    keyframes: Array<Keyframe>;
    onfinish: (() => void) | null;
    options: KeyframeAnimationOptions;
    pause: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    playState: AnimationPlayState;
    target: Element;
  }> = [];
  const animate = vi.fn(function (
    this: Element,
    keyframes: Array<Keyframe>,
    options: KeyframeAnimationOptions,
  ) {
    const animation: (typeof animations)[number] = {
      cancel: vi.fn(),
      currentTime: 0,
      finish: () => {
        animation.playState = 'finished';
        animation.onfinish?.();
      },
      keyframes,
      onfinish: null,
      options,
      pause: vi.fn(() => {
        animation.playState = 'paused';
      }),
      play: vi.fn(() => {
        animation.playState = 'running';
      }),
      playState: 'idle',
      target: this,
    };
    animations.push(animation);
    return animation as unknown as Animation;
  });
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate });

  return {
    animate,
    animations,
    restore: () => Reflect.deleteProperty(Element.prototype, 'animate'),
  };
}
