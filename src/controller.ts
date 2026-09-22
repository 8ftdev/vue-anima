import { frameName, normalize } from './styles.js';
import type { AnimaDefaults, AnimaValue } from './types.js';

interface Baseline {
  value: string;
  priority: string;
  computed: string;
}
export interface Controller {
  update: (value: AnimaValue, active?: boolean) => void;
  dispose: () => void;
}

/** Owns only goal properties. No DOM access happens until construction/update. */
export function createController(
  element: HTMLElement,
  defaults: AnimaDefaults = {},
): Controller {
  const base = new Map<string, Baseline>();
  let animation: Animation | undefined;
  let previous: Record<string, string> = {};
  let initialized = false;
  let disposed = false;

  function cancel(): void {
    const current = animation;
    animation = undefined;
    current?.cancel();
  }

  function restore(name: string, original: Baseline): void {
    if (original.value)
      element.style.setProperty(name, original.value, original.priority);
    else element.style.removeProperty(name);
  }

  return {
    update(value, active): void {
      if (disposed) return;
      const next = normalize(element, value, active, defaults);
      const goals = next.active ? next.styles : {};
      const same =
        initialized &&
        Object.keys(previous).length === Object.keys(goals).length &&
        Object.entries(goals).every(([key, val]) => previous[key] === val);
      if (same) return;
      const view = element.ownerDocument.defaultView;
      if (!view) return;
      const computed = view.getComputedStyle(element);
      for (const name of Object.keys(next.styles)) {
        if (!base.has(name))
          base.set(name, {
            value: element.style.getPropertyValue(name),
            priority: element.style.getPropertyPriority(name),
            computed: computed.getPropertyValue(name),
          });
      }
      const from: Record<string, string> = {};
      const to: Record<string, string> = {};
      for (const [name, original] of base) {
        from[frameName(name)] = computed.getPropertyValue(name);
        to[frameName(name)] = goals[name] ?? original.computed;
      }
      const mountFrom = !initialized && next.active;
      if (mountFrom)
        for (const [name, value] of Object.entries(next.from))
          from[frameName(name)] = value;
      const reduced = view.matchMedia(
        '(prefers-reduced-motion: reduce)',
      ).matches;
      const reducedDuration = reduced ? next.reducedOpacityDuration : undefined;
      const opacityOnly = reducedDuration !== undefined;
      const keyframeFrom: Record<string, string> = opacityOnly ? {} : from;
      const keyframeTo: Record<string, string> = opacityOnly ? {} : to;
      if (opacityOnly && from.opacity !== undefined)
        keyframeFrom.opacity = from.opacity;
      if (opacityOnly && to.opacity !== undefined)
        keyframeTo.opacity = to.opacity;
      const timing =
        reducedDuration === undefined
          ? next.timing
          : { ...next.timing, duration: reducedDuration, delay: 0 };
      cancel();
      const shouldAnimate =
        (initialized || (mountFrom && Object.keys(next.from).length > 0)) &&
        timing.duration > 0 &&
        typeof element.animate === 'function' &&
        (!reduced || opacityOnly) &&
        Object.entries(keyframeFrom).some(
          ([name, value]) =>
            keyframeTo[name] !== undefined && value !== keyframeTo[name],
        );
      previous = goals;
      initialized = true;
      const settle = (): void => {
        for (const [name, original] of base) {
          if (goals[name] === undefined) {
            restore(name, original);
            base.delete(name);
          }
        }
        cancel();
      };
      for (const [name, original] of base)
        element.style.setProperty(name, goals[name] ?? original.computed);
      if (!shouldAnimate) {
        settle();
        return;
      }
      try {
        const current = element.animate([keyframeFrom, keyframeTo], timing);
        animation = current;
        void current.finished.then(
          () => {
            if (animation === current) settle();
          },
          () => {
            /* Cancellation is expected when state changes. */
          },
        );
      } catch (error) {
        settle();
        throw error;
      }
    },
    dispose(): void {
      disposed = true;
      cancel();
      for (const [name, original] of base) restore(name, original);
      base.clear();
    },
  };
}
