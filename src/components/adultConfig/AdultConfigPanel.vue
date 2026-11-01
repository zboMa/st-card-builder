<script setup>
import { computed, onMounted, ref } from 'vue';
import { useStore } from '@nanostores/vue';
import { stateVersion, cardStore } from '../../lib/store/cardStore.mjs';
import { adultUiStore } from '../../lib/store/adultStore.mjs';
import { CORRUPTION_ARC_BRIEFS } from '../../lib/corruptionProgress.mjs';
import AdultDashedList from './AdultDashedList.vue';
import AdultSelect from './AdultSelect.vue';
import AdultAddModal from './AdultAddModal.vue';

function api() {
  return window.__adultConfigApi__ || {};
}

const version = useStore(stateVersion);
const ui = useStore(adultUiStore);
const wfKey = ref(0);

const st = computed(function () {
  version.value;
  return cardStore.get() || {};
});

const EMPTY = {
  lists: { worldview: [], flavor: [], posture: [], speech: [], ntl: [], caps: { worldview: '', flavor: '' } },
  worldframe: { forced: '', effectiveId: '', label: '未推断', mapHint: '', options: [] },
  corruptionTargets: [],
  affectionTargets: [],
};

const data = computed(function () {
  version.value;
  return (api().buildView && api().buildView()) || EMPTY;
});

const emptyText = {
  worldview: '尚未添加——点「＋ 新增」多选组合（如魅魔+修仙）。不选则 AI 引擎须填写阶段提示词。',
  flavor: '尚未添加口味——点「＋ 新增」添加；可不选，走普通写法。',
  posture: '尚未添加姿势语言——点「＋ 新增」添加；不占口味槽，可按需添加。',
  speech: '尚未添加情趣话风——点「＋ 新增」添加；不占口味槽，可按需添加。',
  ntl: '尚未添加——点「＋ 新增」添加禁忌方向。',
};

function onToggle(kind, e) {
  var on = !!e.target.checked;
  Promise.resolve(api().toggle(kind, on)).then(function (ok) {
    if (!ok) e.target.checked = !on;
  });
}

async function onWorldframe(value) {
  var ok = await api().setWorldframe(value);
  if (!ok) wfKey.value += 1;
}

async function refreshWorldframe() {
  var ok = await api().refreshWorldframe();
  if (!ok) wfKey.value += 1;
}

function onCorruptionTarget(name, checked) {
  var current = st.value.corruptionSelectedNames;
  var names = (Array.isArray(current) && current.length)
    ? current.slice()
    : (data.value.corruptionTargets || []).filter(function (t) { return t.selected; }).map(function (t) { return t.name; });
  if (checked) {
    if (names.indexOf(name) < 0) names.push(name);
  } else {
    names = names.filter(function (n) { return n !== name; });
  }
  api().setCorruptionSelected(names);
}

function onAffectionTarget(name, checked) {
  var current = st.value.affectionSelectedNames;
  var names = (Array.isArray(current) && current.length)
    ? current.slice()
    : (data.value.affectionTargets || []).filter(function (t) { return t.selected; }).map(function (t) { return t.name; });
  if (checked) {
    if (names.indexOf(name) < 0) names.push(name);
  } else {
    names = names.filter(function (n) { return n !== name; });
  }
  api().setAffectionSelected(names);
}

function onArcBrief(id) {
  var pack = id && CORRUPTION_ARC_BRIEFS[id];
  if (pack) {
    api().setCorruptionBrief(pack.brief || '');
    api().setCorruptionPreset('custom');
  }
}

function onRemove(kind, idx) {
  Promise.resolve(api().removeItem(kind, idx));
}

function onMove(kind, idx, delta) {
  api().moveItem(kind, idx, delta);
}

function onNote(kind, idx, value) {
  api().setNote(kind, idx, value);
}

onMounted(function () {
  if (api().initSelections) api().initSelections();
});
</script>

<template>
  <div class="panel area-adult-config">
    <div class="adult-config-head">
      <h2>世界与限定</h2>
      <p class="ui-hint adult-config-lead">
        卡级统一配置。<strong>世界观预设</strong>喂给 AI 引擎生成（角色 / 世界书 / 开场白）；
        <strong>载体框架</strong>把口味与 NTL 物化为法器·异能·场所。
        NSFW 段仅世界书管道读取，主角 Description / 开场白不注入。
        条目旁只显示短摘要；完整写法在「提示词配置」目录 Tab。
      </p>
    </div>

    <div class="form-group char-nsfw-block">
      <section class="adult-wv-section" aria-labelledby="adultWvHeading">
        <div class="char-nsfw-flavor-line" style="margin-bottom:6px;">
          <span id="adultWvHeading" class="char-nsfw-sub">世界观预设</span>
          <span class="char-nsfw-subtitle">最多 3 项；首项为主底盘，其余为叠加层</span>
          <span id="adultWvCap" class="char-nsfw-subtitle">{{ data.lists.caps.worldview }}</span>
          <span class="adult-add-spacer"></span>
          <button type="button" class="btn btn-add adult-add-btn" data-adult-add="worldview" @click="api().openAddModal('worldview')">＋ 新增</button>
        </div>
        <div id="adultWorldviewPresetList" class="adult-dashed-list" aria-live="polite">
          <AdultDashedList
            kind="worldview"
            :rows="data.lists.worldview"
            :empty-text="emptyText.worldview"
            @remove="onRemove('worldview', $event)"
            @move="(idx, delta) => onMove('worldview', idx, delta)"
            @note="(idx, value) => onNote('worldview', idx, value)"
          />
        </div>
        <p class="char-nsfw-subtitle" style="margin-top:4px;">
          主预设未强制覆盖时，会映射到下方载体框架。与「载体框架」不是同一目录：预设细、框架粗。
        </p>
      </section>

      <div id="adultWorldframeRow" class="adult-worldframe-row" aria-labelledby="adultWorldframeHeading">
        <span id="adultWorldframeHeading" class="char-nsfw-sub">载体框架</span>
        <span id="adultWorldframeLabel" class="char-nsfw-subtitle">{{ data.worldframe.label }}</span>
        <button type="button" id="btnAdultWorldframeRefresh" class="btn btn-ghost adult-btn-compact" title="清除手动覆盖，按主世界观预设（或卡面信号）重算框架" @click="refreshWorldframe">重新推断</button>
        <AdultSelect
          :key="'wf-' + data.worldframe.forced + '-' + wfKey"
          :model-value="data.worldframe.forced"
          aria-label="覆盖载体框架"
          class="adult-worldframe-select"
          @update:model-value="onWorldframe"
        >
          <option v-for="opt in data.worldframe.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
        </AdultSelect>
        <span id="adultWorldframeMapHint" class="char-nsfw-subtitle">{{ data.worldframe.mapHint }}</span>
        <span class="char-nsfw-subtitle adult-worldframe-refresh-hint">「重新推断」会清掉手动覆盖，按主预设映射重算；手选下拉仍可锁定覆盖。</span>
      </div>

      <div class="char-nsfw-head" style="margin-top:12px;">
        <span class="char-nsfw-label">情欲 / NSFW</span>
        <span class="ui-hint ui-hint--inline">卡级统一口味，供世界书人物与管线读取</span>
      </div>

      <label class="novel-switch">
        <input id="adultNsfwEnabled" type="checkbox" :checked="!!st.nsfwEnabled" @change="onToggle('nsfw', $event)" />
        <span>启用 NSFW</span>
      </label>
      <span class="char-nsfw-subtitle">分析/抽取/丰满/文风/恶堕等统一读取；主角生成不注入</span>

      <section v-if="st.nsfwEnabled" id="adultFlavorSection" class="adult-flavor-section" aria-labelledby="adultFlavorHeading">
        <div class="char-nsfw-flavor-line" style="margin-bottom:6px;">
          <span id="adultFlavorHeading" class="char-nsfw-sub">口味</span>
          <span class="char-nsfw-subtitle">最多 5 个；首项为主调色盘</span>
          <span id="adultNsfwFlavorCap" class="char-nsfw-subtitle">{{ data.lists.caps.flavor }}</span>
          <span class="adult-add-spacer"></span>
          <button type="button" class="btn btn-add adult-add-btn" data-adult-add="flavor" @click="api().openAddModal('flavor')">＋ 新增</button>
        </div>
        <div id="adultNsfwFlavorList" class="adult-dashed-list">
          <AdultDashedList
            kind="flavor"
            :rows="data.lists.flavor"
            :empty-text="emptyText.flavor"
            @remove="onRemove('flavor', $event)"
            @move="(idx, delta) => onMove('flavor', idx, delta)"
            @note="(idx, value) => onNote('flavor', idx, value)"
          />
        </div>
      </section>

      <section v-if="st.nsfwEnabled" id="adultPostureSection" class="adult-expression-section" aria-labelledby="adultPostureHeading">
        <div class="char-nsfw-flavor-line" style="margin-bottom:6px;">
          <span id="adultPostureHeading" class="char-nsfw-sub">姿势语言</span>
          <span class="char-nsfw-subtitle">不占口味槽；可多选；禁止儿童性化</span>
          <span class="adult-add-spacer"></span>
          <button type="button" class="btn btn-add adult-add-btn" data-adult-add="posture" @click="api().openAddModal('posture')">＋ 新增</button>
        </div>
        <p class="char-nsfw-subtitle adult-pref-tip" id="adultPosturePrefTip">
          tip：此处所选为卡的<strong>特别偏好</strong>设定，不代表仅可使用这些姿势；扮演时仍不限制其它体位/玩法。
        </p>
        <div id="adultPostureList" class="adult-dashed-list">
          <AdultDashedList
            kind="posture"
            :rows="data.lists.posture"
            :empty-text="emptyText.posture"
            @remove="onRemove('posture', $event)"
            @move="(idx, delta) => onMove('posture', idx, delta)"
            @note="(idx, value) => onNote('posture', idx, value)"
          />
        </div>
      </section>

      <section v-if="st.nsfwEnabled" id="adultSpeechSection" class="adult-expression-section" aria-labelledby="adultSpeechHeading">
        <div class="char-nsfw-flavor-line" style="margin-bottom:6px;">
          <span id="adultSpeechHeading" class="char-nsfw-sub">情趣话风</span>
          <span class="char-nsfw-subtitle">不占口味槽；可多选；禁止儿童性化</span>
          <span class="adult-add-spacer"></span>
          <button type="button" class="btn btn-add adult-add-btn" data-adult-add="speech" @click="api().openAddModal('speech')">＋ 新增</button>
        </div>
        <p class="char-nsfw-subtitle adult-pref-tip" id="adultSpeechPrefTip">
          tip：此处所选为卡的<strong>特别偏好</strong>设定，不代表仅可使用这些话风；扮演时仍不限制其它语气/口吻。
        </p>
        <div id="adultSpeechList" class="adult-dashed-list">
          <AdultDashedList
            kind="speech"
            :rows="data.lists.speech"
            :empty-text="emptyText.speech"
            @remove="onRemove('speech', $event)"
            @move="(idx, delta) => onMove('speech', idx, delta)"
            @note="(idx, value) => onNote('speech', idx, value)"
          />
        </div>
      </section>

      <section class="adult-ntl-section" aria-labelledby="adultNtlHeading">
        <div class="char-nsfw-flavor-line" style="margin-bottom:4px;">
          <span id="adultNtlHeading" class="char-nsfw-sub">NTL 禁忌</span>
          <label class="novel-switch">
            <input id="adultNtlEnabled" type="checkbox" :checked="!!st.ntlEnabled" @change="onToggle('ntl', $event)" />
            <span>启用</span>
          </label>
          <span class="char-nsfw-subtitle">权力/背德/越界/百破等；多选</span>
          <span class="adult-add-spacer"></span>
          <button type="button" class="btn btn-add adult-add-btn" data-adult-add="ntl" @click="api().openAddModal('ntl')">＋ 新增</button>
        </div>
        <div v-if="st.ntlEnabled" id="adultNtlTabooRow" style="margin-top:4px;">
          <div id="adultNtlTabooList" class="adult-dashed-list">
            <AdultDashedList
              kind="ntl"
              :rows="data.lists.ntl"
              :empty-text="emptyText.ntl"
              @remove="onRemove('ntl', $event)"
              @note="(idx, value) => onNote('ntl', idx, value)"
            />
          </div>
          <span class="char-nsfw-subtitle">点右上「＋ 新增」添加禁忌方向；下方可为每项写补充要求</span>
        </div>
      </section>

      <div v-if="st.nsfwEnabled" id="adultCorruptionBlock" class="char-corruption-block">
        <div class="char-nsfw-flavor-line" style="margin-bottom:6px;">
          <span class="char-nsfw-sub">恶堕进度</span>
          <label class="novel-switch">
            <input id="adultCorruptionEnabled" type="checkbox" :checked="!!st.corruptionEnabled" @change="onToggle('corruption', $event)" />
            <span>启用</span>
          </label>
          <span class="char-nsfw-subtitle">总则 1 条 + 逐人分期档案；不勾选角色时生成「通用档案」，适用于所有/随机女角色</span>
        </div>
        <div v-if="st.corruptionEnabled" id="adultCorruptionBody">
          <div class="char-nsfw-flavor-line" style="margin-bottom:6px;">
            <span class="char-nsfw-sub">阶数</span>
            <AdultSelect
              :model-value="st.corruptionPreset || '5'"
              aria-label="恶堕阶数"
              class="adult-corruption-preset"
              @update:model-value="v => api().setCorruptionPreset(v)"
            >
              <option value="3">简洁 3 阶</option>
              <option value="5">标准 5 阶（默认）</option>
              <option value="7">细腻 7 阶</option>
              <option value="custom">自定义（描述生成）</option>
            </AdultSelect>
            <label class="novel-switch" style="margin-left:4px;">
              <input id="adultCorruptionFemaleOnly" type="checkbox" :checked="st.corruptionDefaultFemaleOnly !== false" @change="v => api().setCorruptionFemaleOnly(v.target.checked)" />
              <span class="char-nsfw-subtitle">默认仅女角色</span>
            </label>
            <label class="novel-switch">
              <input id="adultCorruptionSyncSb" type="checkbox" :checked="st.corruptionSyncStatusBar !== false" @change="v => api().setCorruptionSync(v.target.checked)" />
              <span class="char-nsfw-subtitle">同步状态栏模块</span>
            </label>
          </div>
          <div v-if="st.corruptionPreset === 'custom'" id="adultCorruptionCustomRow" style="margin-bottom:6px;">
            <div class="char-nsfw-flavor-line" style="margin-bottom:6px;">
              <span class="char-nsfw-sub">弧光母题</span>
              <AdultSelect
                model-value=""
                aria-label="恶堕弧光母题包"
                class="adult-corruption-arc"
                @update:model-value="onArcBrief"
              >
                <option value="">自写描述</option>
                <option value="sacred_collapse">圣职崩坏弧</option>
                <option value="hero_complicity">英雄同流弧</option>
                <option value="vengeance_entry">复仇者入局弧</option>
              </AdultSelect>
              <span class="char-nsfw-subtitle">点选可填入下方描述，仍可改写</span>
            </div>
            <textarea id="adultCorruptionCustomBrief" rows="2" placeholder="描述堕落弧光，例如：清纯学妹被一步步引诱，最终主动沉沦……" :value="st.corruptionCustomBrief || ''" @change="v => api().setCorruptionBrief(v.target.value)"></textarea>
          </div>
          <div id="adultCorruptionExtraRow" style="margin-bottom:8px;">
            <div class="char-nsfw-flavor-line" style="margin-bottom:4px;">
              <span class="char-nsfw-sub">附加设定</span>
              <span class="char-nsfw-subtitle">任意阶数可用；写入生成提示以补完/定制堕落细节</span>
            </div>
            <textarea id="adultCorruptionExtraNotes" rows="2" placeholder="可选：补完触发条件、关键人物、禁忌边界、阶段反差重点、口头禅或禁止事项……" :value="st.corruptionExtraNotes || ''" @change="v => api().setCorruptionExtra(v.target.value)"></textarea>
          </div>
          <div class="char-nsfw-subtitle" style="margin-bottom:4px;">生成对象（来自世界书/小说人物；主角自动排除；男角色默认不勾；不勾选则生成「通用档案」适用于所有女角色）</div>
          <div id="adultCorruptionTargets" class="char-corruption-targets">
            <span v-if="!data.corruptionTargets.length" class="char-nsfw-subtitle">暂无可选人物（来自世界书角色/小说人物；主角不出现；通用档案目标仍可生成且不受小说人物限制）</span>
            <label v-for="t in data.corruptionTargets" :key="t.name">
              <input type="checkbox" :checked="t.selected" @change="e => onCorruptionTarget(t.name, e.target.checked)" />
              <span>{{ t.name }}</span>
              <span class="char-nsfw-subtitle">({{ t.meta }})</span>
            </label>
          </div>
          <div class="char-nsfw-flavor-line" style="margin-top:8px;gap:8px;">
            <button type="button" id="btnRefreshCorruptionTargets" class="btn btn-ghost adult-btn-compact" @click="api().refreshTargets('corruption')">刷新角色列表</button>
          </div>
        </div>
      </div>

      <div v-if="st.nsfwEnabled" id="adultAffectionBlock" class="char-corruption-block">
        <div class="char-nsfw-flavor-line" style="margin-bottom:6px;">
          <span class="char-nsfw-sub">纯爱线 · 亲密度</span>
          <label class="novel-switch">
            <input id="adultAffectionEnabled" type="checkbox" :checked="!!st.affectionEnabled" @change="onToggle('affection', $event)" />
            <span>启用</span>
          </label>
          <span class="char-nsfw-subtitle">总则 1 条 + 逐人亲密档案（0-100 数值，可双向波动）；不勾选角色时生成「通用档案」</span>
        </div>
        <div v-if="st.affectionEnabled" id="adultAffectionBody">
          <div class="char-nsfw-flavor-line" style="margin-bottom:6px;">
            <span class="char-nsfw-sub">档位</span>
            <AdultSelect
              :model-value="st.affectionPreset || '6'"
              aria-label="纯爱档位"
              class="adult-affection-preset"
              @update:model-value="v => api().setAffectionPreset(v)"
            >
              <option value="4">简洁 4 阶</option>
              <option value="6">标准 6 阶（默认）</option>
              <option value="8">细腻 8 阶</option>
              <option value="custom">自定义（描述生成）</option>
            </AdultSelect>
            <label class="novel-switch" style="margin-left:4px;">
              <input id="adultAffectionSyncSb" type="checkbox" :checked="st.affectionSyncStatusBar !== false" @change="v => api().setAffectionSync(v.target.checked)" />
              <span class="char-nsfw-subtitle">同步状态栏模块</span>
            </label>
          </div>
          <div v-if="st.affectionPreset === 'custom'" id="adultAffectionCustomRow" style="margin-bottom:6px;">
            <textarea id="adultAffectionCustomBrief" rows="2" placeholder="描述关系基调，例如：欢喜冤家，从针锋相对到互相托付……" :value="st.affectionCustomBrief || ''" @change="v => api().setAffectionBrief(v.target.value)"></textarea>
          </div>
          <div id="adultAffectionExtraRow" style="margin-bottom:8px;">
            <div class="char-nsfw-flavor-line" style="margin-bottom:4px;">
              <span class="char-nsfw-sub">附加设定</span>
              <span class="char-nsfw-subtitle">可选：写入生成提示以补完关系事件、禁忌边界、里程碑重点</span>
            </div>
            <textarea id="adultAffectionExtraNotes" rows="2" placeholder="可选：补完相处模式、专属暗号、告白时机、信任考验重点……" :value="st.affectionExtraNotes || ''" @change="v => api().setAffectionExtra(v.target.value)"></textarea>
          </div>
          <div class="char-nsfw-subtitle" style="margin-bottom:4px;">生成对象（来自世界书/小说人物；主角自动排除；不勾选则生成「通用档案」适用于所有角色）</div>
          <div id="adultAffectionTargets" class="char-corruption-targets">
            <span v-if="!data.affectionTargets.length" class="char-nsfw-subtitle">暂无可用角色（来自世界书/小说人物）</span>
            <label v-for="t in data.affectionTargets" :key="t.name">
              <input type="checkbox" :checked="t.selected" @change="e => onAffectionTarget(t.name, e.target.checked)" />
              <span>{{ t.name }}</span>
            </label>
          </div>
          <div class="char-nsfw-flavor-line" style="margin-top:8px;gap:8px;">
            <button type="button" id="btnRefreshAffectionTargets" class="btn btn-ghost adult-btn-compact" @click="api().refreshTargets('affection')">刷新角色列表</button>
          </div>
        </div>
      </div>

      <span class="char-nsfw-subtitle" style="margin-top:8px;display:block;">口味/NTL 决定人物写法，并物化为世界观载体。均不进入主角 Description。</span>

      <div class="char-nsfw-flavor-line" style="margin-top:10px;gap:8px;padding-top:10px;border-top:1px dashed var(--color-border);">
        <span class="char-nsfw-sub" style="white-space:nowrap;">体系总纲</span>
        <button type="button" id="btnGenSystemDigest" class="btn btn-primary adult-btn-compact" :disabled="!!ui.busy" @click="api().generateDigest()">生成/更新体系总纲</button>
        <button type="button" id="btnClearSystemDigest" class="btn btn-ghost adult-btn-compact" @click="api().removeDigest()">移除</button>
      </div>
      <span class="char-nsfw-subtitle" style="margin-top:4px;display:block;">生成/更新时：先写恶堕世界书（总则 + 每名勾选角色分期档案，需 AI），再把选中体系编译为「[成人体系]」世界书条目（constant 常驻），配置摘要并入总则；导出卡即带。</span>
    </div>

    <AdultAddModal />
  </div>
</template>
