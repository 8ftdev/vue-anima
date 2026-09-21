import { createAnima, type AnimaValue, type GoalResolver } from '../src/index';
import { vAnima as vVaporAnima } from '../src/vapor';
import type { ObjectDirective, VaporDirective } from 'vue';

export const directive = createAnima();
export const vueDirective: ObjectDirective<
  HTMLElement,
  AnimaValue,
  string,
  boolean
> = directive;
export const vaporDirective: VaporDirective<
  HTMLElement,
  AnimaValue,
  never,
  boolean
> = vVaporAnima;

export const valid: AnimaValue = {
  styles: { opacity: 0, backgroundColor: 'red', '--progress': 0 },
  duration: 100,
};
// @ts-expect-error Unknown CSS property must not be accepted.
export const typo: AnimaValue = { styles: { opactiy: 1 } };
export const invalidTiming: AnimaValue = {
  styles: { opacity: 1 },
  // @ts-expect-error Duration is milliseconds, not a CSS time string.
  duration: '1s',
};
const delayedStyles = Promise.resolve({ opacity: 1 });
// @ts-expect-error Resolvers must return CSS styles synchronously.
export const asyncResolver: GoalResolver = () => delayedStyles;

declare const element: HTMLElement;
directive.updated(element, { value: { opacity: 1 }, arg: true });
// @ts-expect-error Activation must be boolean.
directive.updated(element, { value: { opacity: 1 }, arg: 'active' });
