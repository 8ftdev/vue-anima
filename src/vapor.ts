import { watchPostEffect } from 'vue';
import { createController } from './controller.js';
import type { AnimaDefaults, AnimaValue } from './types.js';

export type {
  AnimaDefaults,
  AnimaOptions,
  AnimaValue,
  Goal,
  GoalResolver,
  Styles,
  Timing,
} from './types.js';
/** Accept raw booleans too: vue-tsc 3.3 checks args before getter wrapping. */
export type AnimaDirective = (
  element: HTMLElement,
  value?: () => AnimaValue,
  argument?: boolean | (() => boolean),
  modifiers?: Readonly<Record<string, never>>,
) => () => void;

export function createAnima(defaults: AnimaDefaults = {}): AnimaDirective {
  return (element, value, argument) => {
    const controller = createController(element, defaults);
    const stop = watchPostEffect(() => {
      controller.update(
        value?.() ?? {},
        typeof argument === 'function' ? argument() : argument,
      );
    });
    return () => {
      stop();
      controller.dispose();
    };
  };
}

export const vAnima: AnimaDirective = /* @__PURE__ */ createAnima();
