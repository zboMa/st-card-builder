/**
 * 世界与限定（card 域）写入口。
 * 一律通过 setCardKeys 原地写 + 通知版本号，保证 ctx.state === cardStore.get()。
 */
import { setCardKeys } from './cardStore.mjs';

export function setAdultNsfwEnabled(on) {
  setCardKeys({ nsfwEnabled: !!on });
}

export function setAdultNtlEnabled(on) {
  setCardKeys({ ntlEnabled: !!on });
}

export function setAdultWorldviewItems(items) {
  setCardKeys({ worldviewPresetItems: Array.isArray(items) ? items.slice() : [] });
}

export function setAdultFlavorItems(items) {
  var list = Array.isArray(items) ? items.slice() : [];
  setCardKeys({
    nsfwFlavorItems: list,
    nsfwFlavor: list.length ? list[0].id : '',
  });
}

export function setAdultExpressionItems(kind, items) {
  var list = Array.isArray(items) ? items.slice() : [];
  if (kind === 'speech') setCardKeys({ eroticSpeechItems: list });
  else setCardKeys({ eroticPostureItems: list });
}

export function setAdultNtlItems(items) {
  var list = Array.isArray(items) ? items.slice() : [];
  setCardKeys({
    ntlTabooItems: list,
    ntlTabooTypes: list.map(function (it) { return it.id; }),
  });
}

export function setAdultWorldframe(patch) {
  setCardKeys(patch || {});
}

export function setAdultCorruption(patch) {
  setCardKeys(patch || {});
}

export function setAdultAffection(patch) {
  setCardKeys(patch || {});
}
