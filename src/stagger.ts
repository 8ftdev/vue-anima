import type { AnimaOptions } from './types.js';

/**
 * Share a goal across a sequence, adding `index * step` milliseconds to its delay.
 * The returned values work with both the regular and Vapor `v-anima` directives.
 */
export function createStagger(
  options: AnimaOptions,
  step: number,
): (index: number) => AnimaOptions {
  if (!Number.isFinite(step) || step < 0)
    throw new TypeError(
      'vue-anima: stagger step must be nonnegative and finite',
    );
  const initialDelay = options.delay ?? 0;
  if (!Number.isFinite(initialDelay) || initialDelay < 0)
    throw new TypeError(
      'vue-anima: stagger delay must be nonnegative and finite',
    );
  return (index): AnimaOptions => {
    if (!Number.isSafeInteger(index) || index < 0)
      throw new TypeError(
        'vue-anima: stagger index must be a nonnegative integer',
      );
    const delay = initialDelay + index * step;
    if (!Number.isFinite(delay))
      throw new TypeError('vue-anima: stagger delay must be finite');
    return { ...options, delay };
  };
}
