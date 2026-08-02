import { ENRICHMENT as emotion } from './emotion.mjs';
import { ENRICHMENT as relation } from './relation.mjs';
import { ENRICHMENT as special } from './special.mjs';
import { ENRICHMENT as sensory } from './sensory.mjs';
import { ENRICHMENT as matter } from './matter.mjs';
import { ENRICHMENT as addiction } from './addiction.mjs';
import { ENRICHMENT as extendedKinks } from './extendedKinks.mjs';

/** 合并口味丰满规范 */
export var NSFW_FLAVOR_ENRICHMENT = Object.assign({}, emotion, relation, special, sensory, matter, addiction, extendedKinks);
