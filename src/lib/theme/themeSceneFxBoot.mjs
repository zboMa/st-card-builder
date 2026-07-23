import { initSceneTier } from './themeSceneTier.mjs';
import { initSceneFxHost } from './sceneFx/host.mjs';
import { initSceneFxInteract } from './sceneFx/interact.mjs';

export function initThemeSceneFx() {
  initSceneTier();
  initSceneFxHost();
  initSceneFxInteract();
}
