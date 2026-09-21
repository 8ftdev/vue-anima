/**
 * Vue directive for animating an element between its base CSS styles and a reactive goal.
 *
 * @example
 * ```vue
 * <script setup lang="ts">
 * import { ref } from 'vue';
 * import { vAnima } from '@8ft/vue-anima';
 * const active = ref(false);
 * </script>
 * <template><div style="opacity: 0" v-anima:[active]="{ opacity: 1 }" /></template>
 * ```
 *
 * @module
 */
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
/** Vue directive hooks used by the regular Vue renderer. */
export interface AnimaDirective {
  deep: true;
  mounted: (element: HTMLElement, binding: Binding) => void;
  updated: (element: HTMLElement, binding: Binding) => void;
  beforeUnmount: (element: HTMLElement) => void;
}

/** Create a directive with shared timing defaults and optional goal resolvers. */
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

/** Ready-to-use Vue directive with the default animation timing. */
export const vAnima: AnimaDirective = /* @__PURE__ */ createAnima();
