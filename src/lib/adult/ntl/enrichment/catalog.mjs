/**
 * NTL 丰满规范目录（合并 bond / coercion / rupture / identity / duty / temporal / species / institution / folklore / psyche / digital）
 */
import { ENRICHMENT as BOND } from './bond.mjs';
import { ENRICHMENT as COERCION } from './coercion.mjs';
import { ENRICHMENT as RUPTURE } from './rupture.mjs';
import { ENRICHMENT as IDENTITY } from './identity.mjs';
import { ENRICHMENT as DUTY } from './duty.mjs';
import { ENRICHMENT as TEMPORAL } from './temporal.mjs';
import { ENRICHMENT as SPECIES } from './species.mjs';
import { ENRICHMENT as INSTITUTION } from './institution.mjs';
import { ENRICHMENT as FOLKLORE } from './folklore.mjs';
import { ENRICHMENT as PSYCHE } from './psyche.mjs';
import { ENRICHMENT as DIGITAL } from './digital.mjs';

export var NTL_TABOO_ENRICHMENT = Object.assign(
  {},
  BOND, COERCION, RUPTURE,
  IDENTITY, DUTY,
  TEMPORAL, SPECIES, INSTITUTION, FOLKLORE, PSYCHE, DIGITAL
);
