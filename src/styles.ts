import type { AnimaDefaults, AnimaValue, Goal } from './types.js';

export function cssName(property: string): string {
  return property.startsWith('--')
    ? property
    : property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function frameName(property: string): string {
  return property === 'float'
    ? 'cssFloat'
    : property.startsWith('--')
      ? property
      : property.replace(/-([a-z])/g, (_, letter: string) =>
          letter.toUpperCase(),
        );
}

export function normalize(
  element: HTMLElement,
  value: AnimaValue,
  active: boolean | undefined,
  defaults: AnimaDefaults,
): {
  styles: Record<string, string>;
  active: boolean;
  timing: { duration: number; delay: number; easing: string; fill: 'both' };
} {
  const options =
    typeof value === 'object' && 'styles' in value ? value : { styles: value };
  const duration = options.duration ?? defaults.duration ?? 250;
  const delay = options.delay ?? defaults.delay ?? 0;
  const easing =
    options.easing ?? defaults.easing ?? 'cubic-bezier(0.25, 0.1, 0.25, 1)';
  if (
    !Number.isFinite(duration) ||
    duration < 0 ||
    !Number.isFinite(delay) ||
    delay < 0 ||
    !element.ownerDocument.defaultView?.CSS.supports(
      'animation-timing-function',
      easing,
    )
  ) {
    throw new TypeError('vue-anima: invalid duration, delay or easing');
  }
  // CSS accepts global keywords/lists/variables that WAAPI easing rejects.
  // Validate natively before sampling, canceling, or changing any owned styles.
  const view = element.ownerDocument.defaultView;
  if (typeof view.KeyframeEffect === 'function') {
    new view.KeyframeEffect(null, [], { easing });
  }
  let goal: Goal = options.styles;
  if (typeof goal === 'string') {
    for (const resolver of defaults.resolvers ?? []) {
      const resolved = resolver(goal, element);
      if (resolved !== undefined) {
        goal = resolved;
        break;
      }
    }
  }
  const parser = element.ownerDocument.createElement('div').style;
  if (typeof goal === 'string') {
    parser.cssText = goal;
    if (goal.trim() && !parser.length)
      throw new TypeError(
        'vue-anima: expected CSS declarations or a registered goal resolver',
      );
  } else {
    for (const [property, raw] of Object.entries(goal)) {
      if (raw !== undefined && raw !== null) {
        const name = cssName(property);
        parser.setProperty(name, String(raw));
        if (!parser.getPropertyValue(name))
          throw new TypeError(`vue-anima: invalid CSS value for ${property}`);
      }
    }
  }
  const styles: Record<string, string> = {};
  for (const name of parser) {
    if (parser.getPropertyPriority(name))
      throw new TypeError('vue-anima: goal styles cannot use !important');
    styles[name] = parser.getPropertyValue(name);
  }
  return {
    styles,
    active: active ?? options.active ?? true,
    timing: { duration, delay, easing, fill: 'both' },
  };
}
