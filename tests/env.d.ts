import type { createController } from '../src/controller';
import type { classGoals } from '../src/plugins/classes';
declare global {
  interface Window {
    classGoals: typeof classGoals;
    animaManifest: Readonly<Record<string, readonly string[]>>;
    createController: typeof createController;
  }
}
