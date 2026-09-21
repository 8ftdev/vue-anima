import type { GoalResolver } from '../types.js';

/** Resolve a single unprefixed Tailwind background color utility using generated CSS. */
export function classGoals(): GoalResolver {
  return (goal, element) => {
    // CSS declarations may themselves contain variable names such as --bg-color.
    if (/^[\w-]+\s*:/.test(goal) && !goal.includes(':bg-')) return undefined;
    if (!goal.includes('bg-')) return undefined;
    if (
      !/^bg-(?:[a-z][\w-]*-(?:50|[1-9]00|950)|black|white|transparent|current)(?:\/\d+)?$/.test(
        goal,
      )
    ) {
      throw new TypeError(
        'vue-anima: classGoals supports one plain background color utility',
      );
    }
    const parent = element.parentNode;
    if (!parent || !element.isConnected)
      throw new TypeError('vue-anima: classGoals needs a mounted element');
    // A sibling probe inherits ancestor variables without sampling this element's WAAPI effect.
    const probe = element.ownerDocument.createElement('div');
    probe.style.cssText = element.style.cssText;
    const color =
      element.ownerDocument.defaultView?.getComputedStyle(element).color;
    if (color) probe.style.setProperty('color', color);
    probe.className = goal;
    probe.style.setProperty('display', 'none', 'important');
    probe.style.setProperty('transition', 'none', 'important');
    probe.style.setProperty('animation', 'none', 'important');
    probe.style.removeProperty('background-color');
    try {
      parent.appendChild(probe);
      const backgroundColor =
        element.ownerDocument.defaultView?.getComputedStyle(
          probe,
        ).backgroundColor;
      if (!backgroundColor)
        throw new TypeError('vue-anima: unable to resolve class color');
      return { backgroundColor };
    } finally {
      probe.remove();
    }
  };
}
