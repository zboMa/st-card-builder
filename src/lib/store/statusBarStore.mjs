import { atom } from 'nanostores';

export const statusBarStore = atom({
  includeProtagonist: false,
  nsfw: false,
  extra: '',
  layoutPrompt: '',
  charName: '',
  presetId: '',
  presetLabel: '',
  presets: [],
  moduleGroups: [],
  characters: [],
  paths: [],
  tree: {},
  hasTree: false,
  previewHtml: '',
  snippetCode: '',
  hintText: '',
  floorLabel: '尚无样例',
  canPrev: false,
  canNext: false,
  view: 'preview',
  generateLabel: '生成',
  stepDone: {},
  busy: { vars: false, layout: false, sample: false },
  hasLayout: false,
  hasPaths: false,
});

export function patchStatusBarStore(patch) {
  var old = statusBarStore.get();
  statusBarStore.set(Object.assign({}, old, patch || {}));
}
