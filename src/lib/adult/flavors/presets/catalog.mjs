import { PRESETS as emotion } from './emotion.mjs';
import { PRESETS as relation } from './relation.mjs';
import { PRESETS as special } from './special.mjs';
import { PRESETS as sensory } from './sensory.mjs';
import { PRESETS as matter } from './matter.mjs';
import { PRESETS as addiction } from './addiction.mjs';
import { PRESETS as extendedKinks } from './extendedKinks.mjs';

/** 合并口味预设（含异质物质、成瘾心理与扩展题材） */
export var NSFW_FLAVOR_PRESETS = Object.assign(
  {},
  emotion, relation, special, sensory, matter, addiction, extendedKinks
);
