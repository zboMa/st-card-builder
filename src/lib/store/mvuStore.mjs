import { atom } from 'nanostores';

export const mvuStore = atom({
  statusText: '自动同步角色卡中的 MVU…',
  statusColor: 'var(--color-text-muted)',
  hasCardData: false,
  design: null,
  variables: [],
  groups: [],
  checklist: [],
  summary: '',
  hasResult: false,
  codes: {
    schema: '',
    initvar: '',
    update: '',
    format: '',
    varlist: '',
    regex: '',
  },
  gap: { visible: false, message: '' },
  infer: { open: false, candidates: [], count: 0, newCount: 0 },
  graph: {
    nodes: [],
    connections: [],
    size: { width: 1900, height: 980 },
    expanded: false,
  },
  busy: { add: false, regenPath: '' },
  singleRequirement: '',
});

export function patchMvuStore(patch) {
  var old = mvuStore.get();
  mvuStore.set(Object.assign({}, old, patch || {}));
}
