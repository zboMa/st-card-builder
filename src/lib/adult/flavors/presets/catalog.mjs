import { PRESETS as emotion } from './emotion.mjs';
import { PRESETS as relation } from './relation.mjs';
import { PRESETS as special } from './special.mjs';
import { PRESETS as sensory } from './sensory.mjs';

/** 合并四组口味预设（后写覆盖先写；正常不应有重复 id） */
export var NSFW_FLAVOR_PRESETS = Object.assign({}, emotion, relation, special, sensory);
