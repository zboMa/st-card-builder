import { PRESETS as face } from './face.mjs';
import { PRESETS as rear } from './rear.mjs';
import { PRESETS as riding } from './riding.mjs';
import { PRESETS as side } from './side.mjs';
import { PRESETS as standing } from './standing.mjs';
import { PRESETS as kneeling } from './kneeling.mjs';
import { PRESETS as restraint } from './restraint.mjs';
import { PRESETS as mirror } from './mirror.mjs';
import { PRESETS as carry } from './carry.mjs';
import { PRESETS as scene } from './scene.mjs';
import { PRESETS as adaptive } from './adaptive.mjs';
import { PRESETS as multi } from './multi.mjs';
import { PRESETS as edging } from './edging.mjs';
import { PRESETS as clothed } from './clothed.mjs';

export var EROTIC_POSTURE_PRESETS = Object.assign(
  {},
  face, rear, riding, side, standing, kneeling,
  restraint, mirror, carry, scene, adaptive, multi,
  edging, clothed
);

export var EROTIC_POSTURE_IDS = Object.keys(EROTIC_POSTURE_PRESETS);
