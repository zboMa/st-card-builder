/**
 * NTL 禁忌类型目录（合并 bond / coercion / rupture / identity / duty / temporal / species / institution / folklore / psyche / digital）
 */
import { TYPES as BOND } from './bond.mjs';
import { TYPES as COERCION } from './coercion.mjs';
import { TYPES as RUPTURE } from './rupture.mjs';
import { TYPES as IDENTITY } from './identity.mjs';
import { TYPES as DUTY } from './duty.mjs';
import { TYPES as TEMPORAL } from './temporal.mjs';
import { TYPES as SPECIES } from './species.mjs';
import { TYPES as INSTITUTION } from './institution.mjs';
import { TYPES as FOLKLORE } from './folklore.mjs';
import { TYPES as PSYCHE } from './psyche.mjs';
import { TYPES as DIGITAL } from './digital.mjs';

export var NTL_TABOO_TYPES = Object.assign(
  {},
  BOND, COERCION, RUPTURE,
  IDENTITY, DUTY,
  TEMPORAL, SPECIES, INSTITUTION, FOLKLORE, PSYCHE, DIGITAL
);
