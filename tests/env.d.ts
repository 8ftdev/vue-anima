import type { createController } from '../src/controller';
import type { classGoals } from '../src/plugins/classes';
declare global {
  interface Window {
    classGoals: typeof classGoals;
    createController: typeof createController;
  }
}
