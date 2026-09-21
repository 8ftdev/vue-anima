/**
 * Vue Vapor directive for animating an element to a reactive CSS goal.
 * Import this entrypoint from a `<script setup vapor>` component.
 *
 * @example
 * ```vue
 * <script setup vapor lang="ts">
 * import { ref } from 'vue';
 * import { vAnima } from '@8ft/vue-anima/vapor';
 * const active = ref(false);
 * </script>
 * <template><div style="opacity: 0" v-anima:[active]="{ opacity: 1 }" /></template>
 * ```
 *
 * @module
 */
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
/** Vapor directive signature, accepting a reactive value and boolean argument. */
export type AnimaDirective = (
  element: HTMLElement,
  value?: () => AnimaValue,
  argument?: boolean | (() => boolean),
  modifiers?: Readonly<Record<string, never>>,
) => () => void;

/** Create a Vapor directive with shared timing defaults and goal resolvers. */
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

/** Ready-to-use Vapor directive with the default animation timing. */
export const vAnima: AnimaDirective = /* @__PURE__ */ createAnima();
