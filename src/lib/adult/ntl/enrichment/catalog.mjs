/**
 * NTL 丰满规范目录（合并 bond / coercion / rupture）
 */
import { ENRICHMENT as BOND } from './bond.mjs';
import { ENRICHMENT as COERCION } from './coercion.mjs';
import { ENRICHMENT as RUPTURE } from './rupture.mjs';

export var NTL_TABOO_ENRICHMENT = Object.assign({}, BOND, COERCION, RUPTURE);
