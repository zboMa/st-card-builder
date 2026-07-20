# 目录扩展质量标准

> 扩展 / 增补 **口味 · NTL · 世界观 · 载体 · 表达层（姿势/话风）· 恶堕** 时遵守本文。  
> 配套 UI：侧栏「提示词配置」→ 对应目录 Tab。

---

## 字数硬线（JS `.length`，中文一字算一）

| 字段 | 口味 / NTL / 世界观 / 载体 | **表达层（姿势 · 话风）** |
|---|---|---|
| `summary` | **20–40** | **12–28** |
| `description` | **300–450** | **150–225** |
| `writingGuide` | **350–500** | **175–250** |
| `antiPatterns` | **4–6** 条，条目间独有 | 同左 |

表达层约为口味硬线一半：条目更短、便于多选点配；仍须逐条手写，禁止脚本套路。

---

## 写法原则

1. **逐条手写**：每条主题独有落点（器物 / 场景 / 制度 / 心理），禁止脚本批量灌同构句。
2. **禁止净删降级**：去公式套话后必须用更长独有正文填回；提交前对比增删，不得「字数腰斩」。
3. **拉开句法**：尤其收尾句不要同构（禁止整目录共用同一收束模板）。
4. **可扩写、勿删薄**：在现有正确内容上加厚，不要为「换皮」而砍掉有效信息。

### 禁止的同构套话（示例，不限于此）

- 「三拍」「改变关系秩序」「都提到了却都没咬住」
- 「制度钩子可以是…」同构尾句
- 「要让世界自己参与逼人」等载体旧模板腔
- 机械「开场—中段—收束」换词复读

---

## 四层职责（禁止混写）

| 层 | 职责 | 不要写成 |
|---|---|---|
| **世界观** | 制度 / 生存 / 权力结构 | 口味式情欲教程、NTL 禁忌清单 |
| **口味** | 情欲质地 / 节奏 / 安全余波 | 世界观制度全文、NTL 证据链 |
| **表达层** | 姿势语言 / 情趣话风（多选、不占口味槽） | 口味质地全文、禁忌证据链 |
| **NTL** | 禁忌结构 / 证据链 / 代价 | 口味感官教程、载体巡检手册 |
| **载体 overlays** | **世界如何物化**该口味或禁忌（设施、规章、礼法、器物维保） | 人物层床戏教程 |

---

## 源文件地图

| 层 | 路径 |
|---|---|
| 口味 presets | `src/lib/adult/flavors/presets/{emotion,relation,sensory,special,matter}.mjs` |
| 口味 enrichment | `src/lib/adult/flavors/enrichment/{同名}.mjs`（运行时 `applyFlavorEnrichment` 合并） |
| 口味 summary | `src/lib/adult/flavors/summaries.mjs` |
| NTL types | `src/lib/adult/ntl/types/{bond,coercion,rupture}.mjs` |
| NTL enrichment | `src/lib/adult/ntl/enrichment/{同名}.mjs` |
| NTL summary | `src/lib/adult/ntl/summaries.mjs` |
| 世界观 | `src/lib/presets/worldviews/data/*.mjs`；摘要 `summaries.mjs`；底线 `WORLDVIEW_QUALITY_FLOOR` |
| 载体 overlays | `src/lib/adult/vessels/overlays/{flavor,ntl}.mjs` |
| 表达层姿势 | `src/lib/adult/expression/postures/` |
| 表达层话风 | `src/lib/adult/expression/speech/` |
| 恶堕提示/阶段 | `src/lib/corruptionProgress.mjs`；提示词可进 promptStore |

**注意**：presets / types 源文件不要误写入 enrichment 字段；`mustCover` / `writingGuide` / `antiPatterns` / `signals` 放 enrichment，由 apply 合并。`summary` 走独立 summaries 表挂载。

---

## 成年边界（硬性）

- **禁止儿童性化**；校园等题材角色按**成年设定**处理。
- `age_gap`：`description` 须含「成年礼」「禁止儿童性化」；`writingGuide` 须含「不得以历史早婚」。
- `yuri_destruction`：须显式含「百合破坏」（测试硬匹配）。
- `uniform_ritual`：禁止校服未成年性化。
- `sacrilege`：禁止针对真实宗教群体的仇恨色情。

---

## 工作流程

1. 改前先出**完整方案**；用户明确确认（确认 / 可以 / 确定 / 没问题）后再改代码。
2. 提交前：`npm test` → `npm run build`。
3. 大改目录后附**字数前后对比**（min / max / avg，below 硬线 = 0）。

---

## UI 只读浏览

「提示词配置」中目录类 Tab 为**只读展示**（与源码同源）。改目录请改 `src/lib/**`，不要指望在面板里编辑持久化。
