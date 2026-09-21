import type { CSSProperties } from 'vue';

/** CSS values use CSS units: width: '10px', opacity: 0.5. */
export type Styles = CSSProperties;
export type Goal = Styles | string;

export interface Timing {
  duration?: number;
  delay?: number;
  easing?: string;
}

export interface AnimaOptions extends Timing {
  styles: Goal;
  active?: boolean;
}

export type AnimaValue = Goal | AnimaOptions;

/** Return undefined to let the next resolver (or the CSS parser) handle input. */
export type GoalResolver = (
  goal: string,
  element: HTMLElement,
) => Styles | undefined;

export interface AnimaDefaults extends Timing {
  resolvers?: readonly GoalResolver[];
}
