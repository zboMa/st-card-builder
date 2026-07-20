/**
 * 成人层聚合出口（flavors / ntl / vessels / canon）
 * 业务编排仍可走 novel/nsfwSupport.mjs（兼容门面）
 */
export * from './flavors/index.mjs';
export * from './ntl/index.mjs';
export * from './vessels/index.mjs';
export * from './expression/index.mjs';
export {
  buildAdultCanonDigest,
  formatCorruptionArchiveDigests,
} from './canon.mjs';
