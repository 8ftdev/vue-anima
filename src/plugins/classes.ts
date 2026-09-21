import type { GoalResolver } from '../types.js';

function hasToken(selector: string, escaped: string): boolean {
  const needle = `.${escaped}`;
  let quote = '';
  let brackets = 0;
  for (let index = 0; index < selector.length; index += 1) {
    const character = selector[index] ?? '';
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = '';
    } else if (character === '"' || character === "'") quote = character;
    else if (character === '[') brackets += 1;
    else if (character === ']') brackets -= 1;
    else if (!brackets && selector.startsWith(needle, index)) {
      const next = selector[index + needle.length];
      if (next === undefined || !/[\\\w-]/.test(next)) return true;
    }
  }
  return false;
}

function sheets(element: HTMLElement): CSSStyleSheet[] {
  const document = element.ownerDocument;
  return [...document.styleSheets, ...document.adoptedStyleSheets];
}

function rulesFor(
  rules: CSSRuleList,
  classes: readonly string[],
  element: HTMLElement,
  found: Set<string>,
  properties: Set<string>,
  context = '',
  owned = false,
): void {
  for (const rule of rules) {
    let nestedContext = context;
    let nestedOwned = owned;
    if ('selectorText' in rule && 'style' in rule) {
      const raw = String(rule.selectorText);
      const selector = context ? raw.replaceAll('&', `:is(${context})`) : raw;
      const matches = classes.filter((name) =>
        hasToken(
          selector,
          element.ownerDocument.defaultView?.CSS.escape(name) ?? '',
        ),
      );
      for (const name of matches) found.add(name);
      const owns = owned || matches.length > 0;
      try {
        const applies = owns && element.matches(selector);
        if (applies) {
          for (const property of rule.style as CSSStyleDeclaration)
            properties.add(property);
        }
        nestedContext = selector;
        nestedOwned = applies;
      } catch {
        nestedOwned = false;
      }
    } else if ('style' in rule && owned) {
      for (const property of rule.style as CSSStyleDeclaration)
        properties.add(property);
    }
    if ('cssRules' in rule)
      rulesFor(
        rule.cssRules as CSSRuleList,
        classes,
        element,
        found,
        properties,
        nestedContext,
        nestedOwned,
      );
    if ('styleSheet' in rule && rule.styleSheet) {
      try {
        rulesFor(
          (rule.styleSheet as CSSStyleSheet).cssRules,
          classes,
          element,
          found,
          properties,
          context,
          owned,
        );
      } catch {
        // Cross-origin imports cannot be inspected.
      }
    }
  }
}

function inspect(
  element: HTMLElement,
  classes: readonly string[],
): { found: Set<string>; properties: Set<string> } {
  const found = new Set<string>();
  const properties = new Set<string>();
  for (const sheet of sheets(element)) {
    try {
      rulesFor(sheet.cssRules, classes, element, found, properties);
    } catch {
      // Cross-origin stylesheets cannot be inspected.
    }
  }
  return { found, properties };
}

function styleName(property: string): string {
  return property.startsWith('--')
    ? property
    : property.replace(/-([a-z])/g, (_, letter: string) =>
        letter.toUpperCase(),
      );
}

/** Resolve any compiled class list by comparing class-owned computed styles. */
export function classGoals(): GoalResolver {
  const baselines = new WeakMap<HTMLElement, string>();
  return (goal, element) => {
    const parser = element.ownerDocument.createElement('div').style;
    parser.cssText = goal;
    if (parser.length) return undefined;
    const classes = goal.trim().split(/\s+/).filter(Boolean);
    if (!classes.length) return undefined;

    const parent = element.parentNode;
    const view = element.ownerDocument.defaultView;
    if (!parent || !element.isConnected || !view)
      throw new TypeError('vue-anima: classGoals needs a mounted element');

    let baseline = baselines.get(element);
    if (baseline === undefined) {
      baseline = element.style.cssText;
      baselines.set(element, baseline);
    }
    const source = element.ownerDocument.createElement('div');
    const target = element.ownerDocument.createElement('div');
    source.className = element.className;
    source.style.cssText = baseline;
    target.className = classes.join(' ');
    for (const property of source.style) {
      if (property.startsWith('--')) {
        target.style.setProperty(
          property,
          source.style.getPropertyValue(property),
          source.style.getPropertyPriority(property),
        );
      }
    }

    const position = element.style.getPropertyValue('position');
    const positionPriority = element.style.getPropertyPriority('position');
    element.style.setProperty('position', 'absolute', 'important');
    const next = element.nextSibling;
    try {
      parent.insertBefore(source, next);
      const sourceRules = inspect(source, [...source.classList]);
      for (const property of source.style) sourceRules.properties.add(property);
      const before = view.getComputedStyle(source);
      const color = before.color;
      const values = new Map<string, string>();
      for (const property of before)
        values.set(property, before.getPropertyValue(property));
      source.remove();

      parent.insertBefore(target, next);
      const targetRules = inspect(target, classes);
      if (classes.some((name) => !targetRules.found.has(name))) {
        throw new TypeError(
          'vue-anima: class goal contains a class missing from compiled CSS',
        );
      }
      if (!targetRules.properties.has('color')) target.style.color = color;
      const after = view.getComputedStyle(target);
      const properties = new Set([
        ...sourceRules.properties,
        ...targetRules.properties,
      ]);
      const styles: Record<string, string> = {};
      for (const property of properties) {
        const value = after.getPropertyValue(property);
        if (value !== values.get(property)) styles[styleName(property)] = value;
      }
      return styles;
    } finally {
      element.style.setProperty('position', position, positionPriority);
      source.remove();
      target.remove();
    }
  };
}
