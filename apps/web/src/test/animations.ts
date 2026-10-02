import { vi } from 'vitest';

/**
 * A stand-in for Element.animate, which jsdom lacks. Every call records its
 * target, keyframes and options, and returns an animation whose play, pause
 * and cancel are spies. `restore` removes it again.
 */
export function stubAnimate() {
  const animations: Array<{
    cancel: ReturnType<typeof vi.fn>;
    keyframes: Array<Keyframe>;
    options: KeyframeAnimationOptions;
    pause: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
    target: Element;
  }> = [];
  const animate = vi.fn(function (
    this: Element,
    keyframes: Array<Keyframe>,
    options: KeyframeAnimationOptions,
  ) {
    const animation = {
      cancel: vi.fn(),
      keyframes,
      options,
      pause: vi.fn(),
      play: vi.fn(),
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
