# 目录扩展质量标准

> 扩展 / 增补 **口味 · NTL · 世界观 · 载体** 时遵守本文。不必在每次任务里口头重申。  
> 配套 UI：侧栏「提示词配置」→ Tab「口味目录 / NTL目录 / 世界观 / 载体·* / 扩展规范」。

---

## 字数硬线（JS `.length`，中文一字算一）

| 字段 | 目标区间 |
|---|---|
| `description` | **300–450** |
| `writingGuide` | **350–500** |
| `antiPatterns` | **4–6** 条，且条目间独有、贴主题 |

未达标视为不合格；验收以字数硬线 + 人工抽读为准。

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
| **NTL** | 禁忌结构 / 证据链 / 代价 | 口味感官教程、载体巡检手册 |
| **载体 overlays** | **世界如何物化**该口味或禁忌（设施、规章、礼法、器物维保） | 人物层床戏教程 |

---

## 源文件地图

| 层 | 路径 |
|---|---|
| 口味 presets | `src/lib/adult/flavors/presets/{emotion,relation,sensory,special,matter}.mjs` |
| 口味 enrichment | `src/lib/adult/flavors/enrichment/{同名}.mjs`（运行时 `applyFlavorEnrichment` 合并） |
| NTL types | `src/lib/adult/ntl/types/{bond,coercion,rupture}.mjs` |
| NTL enrichment | `src/lib/adult/ntl/enrichment/{同名}.mjs` |
| 世界观 | `src/lib/presets/worldviews/data/*.mjs`；底线常量 `WORLDVIEW_QUALITY_FLOOR` |
| 载体 overlays | `src/lib/adult/vessels/overlays/{flavor,ntl}.mjs` |

**注意**：presets / types 源文件不要误写入 enrichment 字段；`mustCover` / `writingGuide` / `antiPatterns` / `signals` 放 enrichment，由 apply 合并。

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
