import type { CSSProperties } from 'vue';

/** CSS property values for a goal; include units such as `width: '10px'`. */
export type Styles = CSSProperties;

/** A target expressed as CSS properties or a resolver input string. */
export type Goal = Styles | string;

/** Timing options for a transition, in milliseconds where applicable. */
export interface Timing {
  duration?: number;
  delay?: number;
  easing?: string;
}

/** A goal together with activation and transition timing. */
export interface AnimaOptions extends Timing {
  styles: Goal;
  active?: boolean;
}

/** A directive value: either a goal or an options object containing one. */
export type AnimaValue = Goal | AnimaOptions;

/** Resolve a string goal; return `undefined` to try the next resolver. */
export type GoalResolver = (
  goal: string,
  element: HTMLElement,
) => Styles | undefined;

/** Shared timing and optional goal resolvers for `createAnima`. */
export interface AnimaDefaults extends Timing {
  resolvers?: readonly GoalResolver[];
}
