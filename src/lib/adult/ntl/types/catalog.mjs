/**
 * NTL 禁忌类型目录（合并 bond / coercion / rupture）
 */
import { TYPES as BOND } from './bond.mjs';
import { TYPES as COERCION } from './coercion.mjs';
import { TYPES as RUPTURE } from './rupture.mjs';

export var NTL_TABOO_TYPES = Object.assign({}, BOND, COERCION, RUPTURE);
