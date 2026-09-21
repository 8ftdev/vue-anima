import type { DirectiveBinding } from 'vue';
import { createController } from './controller.js';
import type { Controller } from './controller.js';
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
type Binding = Pick<
  DirectiveBinding<AnimaValue, string, boolean>,
  'value' | 'arg'
>;
/** Use only the binding fields we consume; avoid coupling to renderer VNode types. */
export interface AnimaDirective {
  deep: true;
  mounted: (element: HTMLElement, binding: Binding) => void;
  updated: (element: HTMLElement, binding: Binding) => void;
  beforeUnmount: (element: HTMLElement) => void;
}

export function createAnima(defaults: AnimaDefaults = {}): AnimaDirective {
  const controllers = new WeakMap<HTMLElement, Controller>();
  return {
    deep: true,
    mounted(element, binding): void {
      const controller = createController(element, defaults);
      controllers.set(element, controller);
      controller.update(binding.value, binding.arg);
    },
    updated(element, binding): void {
      controllers.get(element)?.update(binding.value, binding.arg);
    },
    beforeUnmount(element): void {
      controllers.get(element)?.dispose();
      controllers.delete(element);
    },
  };
}

export const vAnima: AnimaDirective = /* @__PURE__ */ createAnima();
