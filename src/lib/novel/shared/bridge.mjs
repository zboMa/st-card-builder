/**
 * 小说工坊助手桥接 + 产出同步
 */
export {
  setCharacterFields, setGreetingFields, applyRagOptionsFromUi, syncRagOptionsToAiPanel,
} from './bridgeFields.mjs';
export { syncOutputs } from './bridgeSyncOutputs.mjs';
export { createBridge } from './bridgeCreate.mjs';
