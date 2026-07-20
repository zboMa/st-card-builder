/**
 * 试聊运行时库（对标 SillyTavern 1.18.0）
 */

export { ST_PARITY_VERSION, ST_PARITY_DIFFS } from './stCompat.mjs';
export { applyMacros } from './macros.mjs';

export {
  SELECTIVE_LOGIC,
  normalizeWorldInfoEntry,
  normalizeWorldInfoEntries,
} from './worldInfo/normalize.mjs';

export {
  scanWorldInfo,
  matchKey,
  matchSecondaryLogic,
} from './worldInfo/scan.mjs';

export {
  injectWorldInfo,
  buildDepthInjections,
  injectDepthIntoHistory,
  partitionActivated,
  joinEntryContents,
  roleToChatRole,
} from './worldInfo/inject.mjs';

export {
  applyRegexPipeline,
  applyRegexToMessages,
  matchesEphemerality,
  matchesDepth,
  PLACEMENT_USER,
  PLACEMENT_AI,
  PLACEMENT_WORLD,
} from './regex/pipeline.mjs';

export { buildChatCompletionMessages } from './prompt/build.mjs';

export {
  buildTrialChatMessages,
  formatWbTriggerTags,
  applyDisplayRegex,
} from './browserChat.mjs';
