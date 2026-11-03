import { atom } from 'nanostores';

export function emptyGreetingMain() {
  return {
    initText: '',
    initHint: '',
    generateLabel: '从正文填写',
    generateDisabled: true,
    generateTitle: '',
    initOpen: false,
    busy: false,
  };
}

export const greetingStore = atom({
  firstMes: '',
  firstMesTokenText: '',
  totalTokenText: '',
  flavorTip: '',
  showFlavorTip: false,
  main: emptyGreetingMain(),
  alts: [],
  busyTarget: '',
  mainInitOpen: false,
  openAlts: [],
  initDrafts: { main: null, alts: {} },
});

export function patchGreetingUi(patch) {
  greetingStore.set(Object.assign({}, greetingStore.get(), patch || {}));
}
