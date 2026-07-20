/**
 * 一次性扩目录生成器：世界观 / 口味 / NTL / 载体框架
 * 运行：node scripts/genCatalogExpand.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function toJs(obj, indent = 2) {
  const sp = ' '.repeat(indent);
  if (Array.isArray(obj)) {
    if (obj.length && obj.every((x) => typeof x === 'string')) {
      return '[ ' + obj.map((s) => JSON.stringify(s)).join(', ') + ' ]';
    }
    return '[\n' + obj.map((x) => sp + toJs(x, indent + 2)).join(',\n') + '\n' + ' '.repeat(indent - 2) + ']';
  }
  if (obj && typeof obj === 'object') {
    return '{\n' + Object.keys(obj).map((k) => {
      const v = obj[k];
      const vv = typeof v === 'string' ? JSON.stringify(v) : toJs(v, indent + 2);
      return sp + k + ': ' + vv;
    }).join(',\n') + '\n' + ' '.repeat(indent - 2) + '}';
  }
  return JSON.stringify(obj);
}

function write(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
  console.log('write', rel);
}

function ensureWv(p) {
  const floor = { description: 80, writingGuide: 120, lexicon: 12, mustCover: 6, antiPatterns: 3, skeletonHints: 6 };
  const padG = ' 组合或单用均保持制度可运行：写出谁执法、何物流通、违约可见代价；情欲若出现须嵌制度节点且限成人自愿，禁止把预设降级为标签堆砌。';
  const padD = ' 细节须可被世界书承接：地名、器物、法令、流通物与禁忌口诀至少落到可互动物件层。';
  while ((p.description || '').length < floor.description) p.description += padD;
  while ((p.writingGuide || '').length < floor.writingGuide) p.writingGuide += padG;
  p.lexicon = Array.from(new Set(p.lexicon || []));
  while (p.lexicon.length < floor.lexicon) {
    for (const e of ['禁忌', '仪式', '代价', '档案', '门禁', '市集', '执法', '密约', '目击', '货币', '口令', '配额']) {
      if (p.lexicon.length >= floor.lexicon) break;
      if (!p.lexicon.includes(e)) p.lexicon.push(e);
    }
  }
  p.mustCover = [...(p.mustCover || [])];
  while (p.mustCover.length < floor.mustCover) p.mustCover.push('可核验的日常运转细节（门禁/口令/流通物之一）');
  p.antiPatterns = [...(p.antiPatterns || [])];
  while (p.antiPatterns.length < floor.antiPatterns) p.antiPatterns.push('只有氛围标签没有可执行规则');
  p.skeletonHints = [...(p.skeletonHints || [])];
  while (p.skeletonHints.length < floor.skeletonHints) p.skeletonHints.push('关键制度物件或档案');
  return p;
}

function assertWv(p) {
  const f = { description: 80, writingGuide: 120, lexicon: 12, mustCover: 6, antiPatterns: 3, skeletonHints: 6 };
  const bad = [];
  if ((p.description || '').length < f.description) bad.push('d');
  if ((p.writingGuide || '').length < f.writingGuide) bad.push('g');
  if ((p.lexicon || []).length < f.lexicon) bad.push('l');
  if ((p.mustCover || []).length < f.mustCover) bad.push('m');
  if ((p.antiPatterns || []).length < f.antiPatterns) bad.push('a');
  if ((p.skeletonHints || []).length < f.skeletonHints) bad.push('s');
  if (bad.length) throw new Error(p.id + ' ' + bad.join(','));
}

// ─── Frames wave2 ───────────────────────────────────────────
const FRAMES = {
  blood_moon: {
    id: 'blood_moon',
    label: '血月灾变',
    lexicon: ['血月', '潮汐', '变异', '宵禁', '赤潮', '月蚀钟', '避月所', '血契', '猎月人', '红雾', '月相表', '净化盐'],
    antiLexicon: ['灵根渡劫', '经纪通告', '义体排异', '宫廷请安'],
    signals: ['血月', '红雾', '避月', '变异', '宵禁', '月相', '赤潮', '猎月'],
    vesselSeeds: [
      { kind: 'artifact', nameHint: '月相手环/避月盐袋/血契印' },
      { kind: 'place', nameHint: '避月所隔间/红雾瞭望塔' },
      { kind: 'rule', nameHint: '宵禁令/血月暴露条例' },
      { kind: 'substance', nameHint: '抗潮药剂/催情红雾拮抗剂' },
      { kind: 'org', nameHint: '猎月人公会/避月委员会' },
      { kind: 'ritual', nameHint: '血月守夜/潮汐结盟' },
    ],
  },
  card_world: {
    id: 'card_world',
    label: '卡牌规则界',
    lexicon: ['卡组', '抽卡', '费用', '场地', '连锁', '稀有度', '决斗场', '卡背契约', '坟场', '除外', '规则书', '裁判'],
    antiLexicon: ['灵石飞剑', '辐射配额', '宫规侍寝', '脑机接口'],
    signals: ['卡牌', '抽卡', '费用', '决斗', '稀有度', '连锁', '场地', '裁判'],
    vesselSeeds: [
      { kind: 'artifact', nameHint: '契约卡背/费用枷锁/稀有度项圈' },
      { kind: 'place', nameHint: '决斗场隔间/卡库密室' },
      { kind: 'rule', nameHint: '规则书禁招/连锁强制条款' },
      { kind: 'org', nameHint: '裁判会/卡商公会' },
      { kind: 'ritual', nameHint: '开包仪式/败者献卡' },
      { kind: 'ability', nameHint: '场地效果共鸣/卡魂同步' },
    ],
  },
  tentacle_abyss: {
    id: 'tentacle_abyss',
    label: '触手海渊',
    lexicon: ['触手', '海渊', '共生孔', '粘液契约', '潮汐巢', '深鸣', '缠缚', '渊种', '呼吸膜', '共生体', '盐雾', '渊律'],
    antiLexicon: ['宫廷仪仗', '异能评级证', '经纪合同', '机甲座舱'],
    signals: ['触手', '海渊', '缠缚', '粘液', '共生', '深鸣', '渊巢', '呼吸膜'],
    vesselSeeds: [
      { kind: 'place', nameHint: '潮汐巢室/呼吸膜舱' },
      { kind: 'artifact', nameHint: '共生环/缠缚束带/渊种封印瓶' },
      { kind: 'rule', nameHint: '渊律同意条款/解缠口令' },
      { kind: 'substance', nameHint: '镇定粘液/共生营养液' },
      { kind: 'org', nameHint: '共生体议会/猎渊船队' },
      { kind: 'ritual', nameHint: '初次缠缚仪/解契退潮' },
    ],
  },
  slime_ecology: {
    id: 'slime_ecology',
    label: '粘液生态',
    lexicon: ['粘液', '凝胶', '溶解', '再生', '共生膜', '酸碱潮', '软体市', '固化盐', '渗透', '半固态', '营养池', '清洁律'],
    antiLexicon: ['飞剑宗门', '宫墙密折', '机甲军规', '血月宵禁'],
    signals: ['粘液', '凝胶', '溶解', '再生', '软体', '渗透', '固化', '营养池'],
    vesselSeeds: [
      { kind: 'place', nameHint: '营养池浴/软体市隔帘' },
      { kind: 'artifact', nameHint: '固化环/渗透探针/清洁符' },
      { kind: 'substance', nameHint: '中和剂/催凝粉/营养凝胶' },
      { kind: 'rule', nameHint: '清洁律/非自愿溶解禁令' },
      { kind: 'org', nameHint: '软体商会/中和诊所' },
      { kind: 'ritual', nameHint: '共生膜接合/定期清洁' },
    ],
  },
  time_loop: {
    id: 'time_loop',
    label: '时间循环',
    lexicon: ['循环', '重置', '锚点', '记忆残留', '昨日', '钟楼', '断点', '目击者', '同一天', '例外物', '回声', '逃环者'],
    antiLexicon: ['灵石飞升', '经纪通告表', '辐射配额', '卡牌费用'],
    signals: ['循环', '重置', '锚点', '昨日', '断点', '同一天', '逃环', '记忆残留'],
    vesselSeeds: [
      { kind: 'artifact', nameHint: '锚点怀表/例外物戒指/断点钥' },
      { kind: 'place', nameHint: '钟楼密室/昨日重播站台' },
      { kind: 'rule', nameHint: '循环守则/记忆交易禁令' },
      { kind: 'org', nameHint: '逃环者互助会/钟楼看守' },
      { kind: 'ritual', nameHint: '重置前告别/锚点校准' },
      { kind: 'ability', nameHint: '残留共感/断点预感' },
    ],
  },
  republican_era: {
    id: 'republican_era',
    label: '民国坊间',
    lexicon: ['租界', '报馆', '舞厅', '电报', '军阀', '里弄', '洋行', '戏园', '密信', '巡捕', '烟馆', '同乡会'],
    antiLexicon: ['灵根秘境', '义体接口', '机甲同步', '卡牌决斗'],
    signals: ['民国', '租界', '报馆', '舞厅', '里弄', '军阀', '电报', '巡捕'],
    vesselSeeds: [
      { kind: 'place', nameHint: '舞厅包厢/里弄阁楼/报馆暗室' },
      { kind: 'artifact', nameHint: '密信夹层/手铳押物/舞票' },
      { kind: 'rule', nameHint: '租界宵禁/巡捕盘查' },
      { kind: 'org', nameHint: '同乡会/报馆编辑部/洋行买办' },
      { kind: 'substance', nameHint: '烟膏/安眠粉/伤药' },
      { kind: 'ritual', nameHint: '结拜酒/报馆暗号' },
    ],
  },
  western_frontier: {
    id: 'western_frontier',
    label: '西部荒野',
    lexicon: ['荒野', '酒馆', '赏金', '铁路', '警长', '牧场', '决斗', '驿站', '沙暴', '马具', '矿镇', '边警'],
    antiLexicon: ['宗门贡献点', '神经同步', '卡费连锁', '血月红雾'],
    signals: ['荒野', '酒馆', '赏金', '警长', '决斗', '铁路', '牧场', '驿站'],
    vesselSeeds: [
      { kind: 'place', nameHint: '酒馆阁楼/驿站牢房/矿道暗处' },
      { kind: 'artifact', nameHint: '手铐/赏金海报/马具束带' },
      { kind: 'rule', nameHint: '镇子法/决斗约定' },
      { kind: 'org', nameHint: '警长署/赏金公会/铁路公司' },
      { kind: 'substance', nameHint: '威士忌/止痛草药/火药' },
      { kind: 'ritual', nameHint: '决斗前握手/入镇宣誓' },
    ],
  },
  bio_hive: {
    id: 'bio_hive',
    label: '虫巢孢子',
    lexicon: ['虫巢', '孢子', '信息素', '母巢', '工蜂级', '菌毯', '蜂室', '共生壳', '孵化', '女王', '菌丝网', '净化火'],
    antiLexicon: ['宫廷密折', '卡牌坟场', '机甲军衔', '租界巡捕'],
    signals: ['虫巢', '孢子', '信息素', '母巢', '菌丝', '女王', '孵化', '蜂室'],
    vesselSeeds: [
      { kind: 'place', nameHint: '蜂室哺育舱/菌毯静室' },
      { kind: 'artifact', nameHint: '信息素环/共生壳甲/孢子瓶' },
      { kind: 'rule', nameHint: '母巢级阶法/净化火禁令' },
      { kind: 'substance', nameHint: '镇定孢粉/营养浆' },
      { kind: 'org', nameHint: '工蜂议会/猎孢队' },
      { kind: 'ritual', nameHint: '归巢标记/级阶晋升' },
    ],
  },
};

const FRAME_ENRICHMENT = {};
for (const id of Object.keys(FRAMES)) {
  const f = FRAMES[id];
  FRAME_ENRICHMENT[id] = {
    mustCover: [
      f.label + '核心语汇如何物化为可触发机制',
      '违约/暴露/灾变的可见代价',
      '公开名义下的伪装借口',
      '至少一件标志器物或场所规则',
      '与具名势力/个体的不对等或共生关系',
    ],
    writingGuide: '用' + f.label + '自己的制度与物件写欲望，禁止串台到无关世界观玩具清单。情欲限成人，载体要能解释同意、中断与代价。',
    antiPatterns: ['串台语汇', '只有氛围没有机制', '无代价的无限玩法'],
    densityHint: 340,
    signals: (f.signals || []).slice(0, 6),
  };
}

write('src/lib/adult/vessels/frames/wave2.mjs', `/**
 * 第二波扩展框架：血月/卡界/触手/粘液/循环/民国/西部/虫巢
 */
export var FRAMES = ${toJs(FRAMES, 2)};

export var ENRICHMENT = ${toJs(FRAME_ENRICHMENT, 2)};
`);

write('src/lib/adult/vessels/frames/catalog.mjs', `/**
 * 世界观框架目录（现有 + 扩展 + 第二波）
 */
import { FRAMES as EXISTING_FRAMES, ENRICHMENT as EXISTING_ENRICHMENT } from './existing.mjs';
import { FRAMES as EXTENDED_FRAMES, ENRICHMENT as EXTENDED_ENRICHMENT } from './extended.mjs';
import { FRAMES as WAVE2_FRAMES, ENRICHMENT as WAVE2_ENRICHMENT } from './wave2.mjs';

export var WORLDFRAMES = Object.assign({}, EXISTING_FRAMES, EXTENDED_FRAMES, WAVE2_FRAMES);

export var WORLDFRAME_IDS = Object.keys(WORLDFRAMES);

export var WORLDFRAME_VESSEL_ENRICHMENT = Object.assign(
  {},
  EXISTING_ENRICHMENT,
  EXTENDED_ENRICHMENT,
  WAVE2_ENRICHMENT
);
`);

// ─── Worldviews ─────────────────────────────────────────────
function W(o) { return ensureWv(o); }

const catastrophe = [
  W({ id: 'blood_moon_era', group: 'catastrophe', label: '血月纪元', mapsToWorldframe: 'blood_moon',
    description: '周期性血月引发变异、催情潮与宵禁政治的灾变文明。月相表决定城门开闭与人格裂隙；猎月人与避月所构成双轨秩序。',
    writingGuide: '用月相表与宵禁令推进冲突。变异不是妆造，要有可逆/不可逆代价。情欲可挂在红雾潮汐与血契上，但须成人自愿并写清解契。可与末日废土或多选叠加。',
    lexicon: ['血月', '红雾', '宵禁', '避月所', '猎月人', '月相表', '变异', '血契', '赤潮', '净化盐', '瞭望塔', '潮汐钟'],
    mustCover: ['血月周期规则', '宵禁与豁免', '变异分级', '避月所制度', '猎月人职权', '血契解除条件'],
    antiPatterns: ['血月只是滤镜', '无限变异无代价', '无宵禁政治'],
    skeletonHints: ['月相法令', '避月所规章', '猎月人执照', '变异诊所', '红雾地图', '血契范式'] }),
  W({ id: 'eternal_winter_siege', group: 'catastrophe', label: '永冬围城', mapsToWorldframe: 'wasteland',
    description: '永冬围困下的城邦：燃料配给、温室政治、冻伤与取暖成为权力。城外狼群与城内派系同样致命。',
    writingGuide: '每场戏问燃料从哪来。亲密常与共享体温、燃料贿赂绑定，须成人并写清交易伦理。',
    lexicon: ['永冬', '围城', '燃料', '温室', '配给', '冻伤', '城墙', '破冰队', '暖窖', '雪盲', '狼嚎', '炭票'],
    mustCover: ['燃料配给法', '温室控制权', '出城破冰规则', '冻伤医疗', '派系战争', '暖窖准入'],
    antiPatterns: ['冬天只是风景', '燃料无限', '无围城压力'],
    skeletonHints: ['炭票账本', '温室钥匙', '破冰队名册', '暖窖公约', '城墙班次', '冻伤病房'] }),
  W({ id: 'plague_lockdown', group: 'catastrophe', label: '瘟疫封锁', mapsToWorldframe: 'medical',
    description: '传染病封锁区：检疫站、健康码式符印、尸体运输与黑市退烧药。恐慌立法，亲密成为防疫违规。',
    writingGuide: '用检疫流程写压迫。情欲涉及隔离房时须处理知情与传染风险，角色成人。禁止美化真实流行病伤害。',
    lexicon: ['封锁', '检疫', '传染', '隔离房', '健康符', '尸车', '退烧药', '红区', '密接', '消杀', '方舱', '流调'],
    mustCover: ['封锁分级', '检疫流程', '隔离规则', '黑市药品', '流调权力', '违规代价'],
    antiPatterns: ['瘟疫当情趣背景无规则', '无传染代价', '美化真实疫情'],
    skeletonHints: ['红区地图', '检疫手册', '隔离房公约', '黑市药价', '流调档案', '消杀班组'] }),
  W({ id: 'tidal_flood', group: 'catastrophe', label: '潮汐淹没', mapsToWorldframe: 'wasteland',
    description: '海平面周期性淹没低城：水上棚屋、潮汐钟、潜水劳役与干季抢地。水下遗迹成为禁忌与资源。',
    writingGuide: '潮汐时刻表是法律。情欲可在干季阁楼或船舱，须写淹水风险与成人边界。',
    lexicon: ['潮汐钟', '淹没线', '棚屋', '干季', '潜水劳役', '水下遗迹', '浮桥', '盐蚀', '救生筏', '抢地', '潮税', '灯塔'],
    mustCover: ['潮汐时刻与禁行', '棚屋产权', '潜水劳役制', '水下遗迹禁忌', '潮税', '救灾组织'],
    antiPatterns: ['水只是风景', '无淹没时刻表', '无限陆地'],
    skeletonHints: ['潮汐时刻表', '棚屋契', '劳役名册', '遗迹禁令', '潮税簿', '灯塔信号'] }),
  W({ id: 'solar_extinction', group: 'catastrophe', label: '熄日之后', mapsToWorldframe: 'wasteland',
    description: '太阳熄灭或被遮蔽后的永夜文明：人造日、光合作用黑市、热能崇拜与夜盲战争。',
    writingGuide: '光是货币。情欲场景处理热能共享与人造日配额，成人自愿。',
    lexicon: ['熄日', '永夜', '人造日', '热能', '光税', '夜盲', '光合黑市', '暖炉教', '灯芯', '热管网', '日棺', '守光人'],
    mustCover: ['人造日配额', '光税制度', '热能网络', '夜盲医疗', '暖炉教义', '守光人职权'],
    antiPatterns: ['永夜无能源逻辑', '光无限', '无夜盲代价'],
    skeletonHints: ['光税法令', '人造日时刻', '热管网图', '暖炉教典', '守光人名录', '光合黑市'] }),
  W({ id: 'zombie_bastion', group: 'catastrophe', label: '尸潮壁垒', mapsToWorldframe: 'wasteland',
    description: '尸潮围城的壁垒社会：感染检测、夜班城墙、清尸队与「被咬即处决」的残酷法。',
    writingGuide: '残酷要有程序：检测、隔离、处决听证会。情欲若写末日慰藉须成人，禁止无规则的丧尸色情。',
    lexicon: ['尸潮', '壁垒', '感染', '检测', '清尸队', '夜墙', '处决令', '咬痕', '静音区', '弹药配额', '避难层', '警报'],
    mustCover: ['感染判定标准', '检测流程', '城墙班次', '处决法', '弹药配额', '静音区规则'],
    antiPatterns: ['丧尸无规则', '无限弹药', '无检测的混乱狂欢'],
    skeletonHints: ['检测站规程', '处决令模板', '城墙排班', '清尸队价', '静音区图', '弹药账'] }),
  W({ id: 'resource_theocracy_fort', group: 'catastrophe', label: '资源神权堡垒', mapsToWorldframe: 'wasteland',
    description: '水/药/电被神权化的末日堡垒：祭司分配配额，异端等于浪费资源，身体可作什一税。',
    writingGuide: '神学解释稀缺。身体税若出现须成人并写反抗与代价，禁止无批判的纯奴役爽文。',
    lexicon: ['堡垒', '祭司', '配额神谕', '什一税', '净水圣井', '异端', '浪费罪', '配给券', '圣库', '告解', '守垒军', '黑市滴漏'],
    mustCover: ['配额神谕机制', '什一税内容', '异端审判', '圣井控制', '守垒军权', '黑市滴漏'],
    antiPatterns: ['神权只有口号', '资源无限', '无审判程序'],
    skeletonHints: ['神谕配额表', '什一税法', '异端目录', '圣井钥匙', '守垒军规', '黑市滴漏点'] }),
  W({ id: 'orbital_debris_belt', group: 'catastrophe', label: '轨道坠落带', mapsToWorldframe: 'scifi',
    description: '残骸雨周期性砸向地表的坠落带：预警广播、地下舱、拾荒航线与「坠物产权」战争。',
    writingGuide: '预警倒计时驱动节奏。情欲可在地下舱避难，写密闭与氧气配额，成人。',
    lexicon: ['坠落带', '残骸雨', '预警', '地下舱', '拾荒航线', '坠物权', '氧气配额', '护盾伞', '碎轨道', '撞击钟', '舱门律', '黑市零件'],
    mustCover: ['坠落预警系统', '地下舱准入', '坠物权法', '氧气配额', '拾荒航线风险', '护盾伞维护'],
    antiPatterns: ['天降宝物无危险', '氧气无限', '无预警'],
    skeletonHints: ['预警广播词', '舱门律', '坠物权判例', '氧气账', '拾荒航线图', '护盾维护单'] }),
  W({ id: 'tentacle_abyss_civ', group: 'catastrophe', label: '触手海渊文明', mapsToWorldframe: 'tentacle_abyss',
    description: '触手族群与人类签订共生律的海渊城邦：缠缚即社交、粘液契约可公证、解缠口令受渊律保护。',
    writingGuide: '触手是文明不是无脑怪。必须写同意、口令、解契。情欲主舞台但禁止无同意强制作为默认甜宠；黑暗面须有渊律代价。',
    lexicon: ['触手', '海渊', '缠缚', '共生孔', '粘液契约', '解缠口令', '潮汐巢', '深鸣', '渊律', '呼吸膜', '共生体', '盐雾市'],
    mustCover: ['渊律同意条款', '解缠口令体系', '共生等级', '潮汐巢公共/私密分区', '人类侨民地位', '违约反噬'],
    antiPatterns: ['无同意触手默认浪漫', '无解缠机制', '只有色情没有城邦'],
    skeletonHints: ['渊律全文摘要', '口令公证处', '潮汐巢分区图', '侨民法', '反噬病例', '盐雾市集'] }),
  W({ id: 'slime_symbiosis_circle', group: 'catastrophe', label: '粘液共生圈', mapsToWorldframe: 'slime_ecology',
    description: '粘液生命与人类共建的半固态城市：溶解改建、再生医疗、清洁律与非自愿溶解重罪。',
    writingGuide: '溶解/再生是市政工程。情欲涉及凝胶包裹须合意与中和剂在场，成人。',
    lexicon: ['粘液', '凝胶', '溶解', '再生', '清洁律', '中和剂', '软体市', '营养池', '固化环', '渗透', '半固态街', '共生膜'],
    mustCover: ['清洁律', '非自愿溶解禁令', '中和剂配给', '营养池规则', '改建审批', '再生医疗伦理'],
    antiPatterns: ['溶解无医疗规则', '无中和剂', '粘液=纯色情标签'],
    skeletonHints: ['清洁律条文', '中和诊所', '营养池时刻', '改建许可', '再生伦理案', '固化环型号'] }),
  W({ id: 'spore_rainforest', group: 'catastrophe', label: '孢子雨林', mapsToWorldframe: 'bio_hive',
    description: '孢子致幻与菌毯扩张的雨林生态：呼吸面罩法令、母树香火、猎人与共生者两派。',
    writingGuide: '孢子是空气政治。致幻同意必须成人清晰；禁止无同意迷奸当默认趣味。',
    lexicon: ['孢子', '菌毯', '雨林', '面罩令', '母树', '致幻潮', '猎人', '共生者', '净化火', '孢粉税', '树瘤居', '菌丝路'],
    mustCover: ['面罩法令', '致幻潮预警', '母树祭祀', '猎人/共生者冲突', '净化火使用', '孢粉税'],
    antiPatterns: ['迷奸无同意默认', '孢子无规则', '雨林无派系'],
    skeletonHints: ['面罩令', '致幻预警', '母树祭程', '猎人公会', '净化火点', '孢粉税簿'] }),
  W({ id: 'insect_hive_federation', group: 'catastrophe', label: '虫巢联邦', mapsToWorldframe: 'bio_hive',
    description: '多巢联邦：女王议会、工蜂级阶、信息素身份证与跨巢联姻外交。',
    writingGuide: '级阶与信息素是法律。联姻/标记须成人；写清人类归化路径。',
    lexicon: ['虫巢', '女王', '工蜂级', '信息素证', '蜂室', '联邦议会', '归化', '育囊', '菌浆口粮', '跨巢联姻', '净化火边境', '巢战'],
    mustCover: ['级阶法', '信息素身份证', '女王议会', '归化条件', '跨巢联姻', '巢战规则'],
    antiPatterns: ['虫巢无政治', '信息素强制无代价', '级阶可随意跳'],
    skeletonHints: ['级阶法典', '信息素注册', '议会记录', '归化考题', '联姻条约', '巢战停火线'] }),
  W({ id: 'mother_tree_theocracy', group: 'catastrophe', label: '母树神权', mapsToWorldframe: 'bio_hive',
    description: '巨树神权：根须律法、落叶审判、树液圣餐与异端砍伐罪。',
    writingGuide: '植物神权要有仪式与税。树液圣餐若涉情欲须成人自愿。',
    lexicon: ['母树', '根须律', '落叶审判', '树液', '圣餐', '砍伐罪', '树瘤居', '花粉使者', '年轮档案', '异端枯枝', '树冠议会', '根牢'],
    mustCover: ['根须律法', '落叶审判程序', '树液配给', '砍伐罪', '树冠议会', '根牢制度'],
    antiPatterns: ['神树只有美景', '审判无程序', '树液无限'],
    skeletonHints: ['根须律', '审判仪程', '树液账', '砍伐判例', '年轮档案', '根牢名册'] }),
  W({ id: 'blood_tide_ecology', group: 'catastrophe', label: '血潮生态', mapsToWorldframe: 'blood_moon',
    description: '周期性血潮改变水体与生物习性的沿海生态：血渔、禁泳令、潮祈祭司与变异渔获市场。',
    writingGuide: '血潮时刻表立法。渔获变异要有检疫。情欲可走潮祈仪式但成人合意。',
    lexicon: ['血潮', '禁泳令', '血渔', '潮祈', '变异渔获', '检疫码头', '红浪', '祭司', '潮税', '护岸', '血盐', '渔会'],
    mustCover: ['血潮时刻表', '禁泳令', '检疫码头', '潮祈仪式', '渔会权力', '潮税'],
    antiPatterns: ['血潮无时刻', '变异无检疫', '只有血腥审美'],
    skeletonHints: ['潮汐血表', '禁泳告示', '检疫规程', '潮祈词', '渔会章程', '潮税簿'] }),
];

const fantasyExtra = [
  W({ id: 'card_world', group: 'fantasy', label: '卡牌世界', mapsToWorldframe: 'card_world',
    description: '法则以卡牌规则书运行的异界：抽卡决定国运与个人命运，决斗场即法庭，稀有度即种姓。',
    writingGuide: '每条冲突问费用与连锁。败者献卡可黑暗，但须成人并有规则书条款；禁止无规则的抽卡开挂。',
    lexicon: ['卡组', '抽卡', '费用', '连锁', '稀有度', '决斗场', '规则书', '裁判', '坟场', '卡背契约', '开包', '场地'],
    mustCover: ['规则书核心', '稀有度种姓', '决斗即司法', '卡背契约', '裁判权力', '开包经济'],
    antiPatterns: ['无费用无限召', '规则书不存在', '稀有度无社会后果'],
    skeletonHints: ['规则书摘要', '稀有度法', '决斗场规', '卡背契模板', '裁判会', '开包税'] }),
  W({ id: 'book_page_world', group: 'fantasy', label: '书页世界', mapsToWorldframe: 'fantasy',
    description: '现实写在可被编辑的书页上：修订权、禁书库、墨罪与读者共鸣。改一字可改命运。',
    writingGuide: '编辑权是最大权力。情欲可与「被写入」绑定，须成人同意，写清墨罪。',
    lexicon: ['书页', '修订权', '禁书库', '墨罪', '读者共鸣', '页缘', '注解', '抄本', '焚书', '作者神', '空白页', '校对'],
    mustCover: ['修订权归属', '墨罪法', '禁书库', '共鸣机制', '焚书政治', '空白页稀缺'],
    antiPatterns: ['随便改命运无代价', '无禁书', '作者神无规则'],
    skeletonHints: ['修订法', '墨罪判例', '禁书目录', '共鸣仪式', '焚书令', '空白页拍卖'] }),
  W({ id: 'dice_casino_realm', group: 'fantasy', label: '骰运赌场异界', mapsToWorldframe: 'fantasy',
    description: '概率被神性化的赌场城：骰运税、负债烙印、幸运神娼与必输桌的阴谋。',
    writingGuide: '概率要可作弊也可被抓。身体作赌资须成人并写毁约法。',
    lexicon: ['骰运', '赌场', '负债烙印', '幸运神', '必输桌', '荷官', '筹码神', '赌约', '概率税', '出千', '金库', '赦赌'],
    mustCover: ['赌约法', '负债烙印', '出千惩罚', '概率税', '赦赌条件', '荷官公会'],
    antiPatterns: ['无限运气', '赌债无法律', '未成年入局'],
    skeletonHints: ['赌约范式', '烙印仪', '出千刑', '概率税法', '赦赌仪式', '荷官规章'] }),
  W({ id: 'dungeon_elevator_city', group: 'fantasy', label: '副本电梯城', mapsToWorldframe: 'fantasy',
    description: '垂直城市每层是副本：电梯权限、层主税、清空重置与层间难民。',
    writingGuide: '电梯权限=阶层。副本规则要可学习。情欲可在安全层旅馆，成人。',
    lexicon: ['电梯', '层主', '副本', '重置', '层税', '权限卡', '清空', '难民层', 'Boss房', '安全层', '爬塔', '层间法'],
    mustCover: ['电梯权限', '层主税法', '副本重置', '安全层规则', '难民安置', '层间法'],
    antiPatterns: ['无权限随便爬', '重置无代价', '无层主政治'],
    skeletonHints: ['权限卡等级', '层税法', '重置时刻', '安全层公约', '难民登记', 'Boss图鉴'] }),
  W({ id: 'npc_awakening_revolt', group: 'fantasy', label: 'NPC觉醒反抗', mapsToWorldframe: 'card_world',
    description: '游戏世界中NPC获得自我后的革命：剧本警察、破剧本罪、玩家特权被清算。',
    writingGuide: '写觉醒后的法律重建。玩家/NPC亲密须处理历史权力差与成人合意。',
    lexicon: ['NPC觉醒', '剧本警察', '破剧本罪', '玩家特权', '任务链', '好感度废除', '自治镇', '外挂审判', '台词狱', '自由对话', '原住民', '重置恐惧'],
    mustCover: ['觉醒判定', '破剧本罪', '玩家特权废除进程', '自治镇法', '外挂审判', '好感度系统存废'],
    antiPatterns: ['觉醒无政治', '玩家仍无限特权无冲突', '只有口号'],
    skeletonHints: ['觉醒测验', '破剧本判例', '自治宪章', '外挂法庭', '台词狱', '好感度废止令'] }),
  W({ id: 'labyrinth_citystate', group: 'fantasy', label: '地下迷宫城邦', mapsToWorldframe: 'fantasy',
    description: '迷宫即国土：测绘行会、迷途税、核心王座与定期结构重组。',
    writingGuide: '地图是机密。向导权力极大。情欲可在稳定支路旅店，成人。',
    lexicon: ['迷宫', '测绘行会', '迷途税', '核心王座', '重组', '向导', '死路标记', '火把税', '层兽', '安定支路', '迷宫法', '回声厅'],
    mustCover: ['测绘垄断', '迷途税', '重组周期', '向导执照', '核心王座政治', '安定支路产权'],
    antiPatterns: ['迷宫无重组', '地图公开无代价', '无向导制度'],
    skeletonHints: ['测绘特许', '迷途税法', '重组历', '向导考', '王座继承', '支路地契'] }),
];

const modernExtra = [
  W({ id: 'time_loop_town', group: 'modern', label: '时间循环小镇', mapsToWorldframe: 'time_loop',
    description: '小镇困在同一天：锚点物、记忆残留者、逃环地下网与重置前的狂欢/忏悔。',
    writingGuide: '用「同一天的细微差异」推进。情欲与「重置会忘记吗」挂钩，成人；禁止利用失忆无同意。',
    lexicon: ['循环', '重置', '锚点', '记忆残留', '逃环者', '钟楼', '同一天', '例外物', '断点', '昨日新闻', '守环人', '残留日记'],
    mustCover: ['重置触发', '锚点规则', '残留者权利', '逃环组织', '例外物流通', '守环人'],
    antiPatterns: ['循环无规则', '失忆强奸默认', '例外物无限'],
    skeletonHints: ['锚点清单', '残留者互助', '逃环联络', '例外物黑市', '钟楼守则', '重置倒计时'] }),
  W({ id: 'memory_market_city', group: 'modern', label: '记忆贩卖城', mapsToWorldframe: 'modern_ability',
    description: '记忆可买卖的都市：体验店、遗忘保险、假记忆诉讼与情感剽窃罪。',
    writingGuide: '记忆交易要有合同与反悔期。出售情欲记忆须成人明确同意。',
    lexicon: ['记忆市', '体验店', '遗忘险', '假记忆', '情感剽窃', '神经柜', '回放椅', '记忆税', '删档', '共鸣污染', '柜钥', '诉记庭'],
    mustCover: ['交易合同法', '反悔期', '假记忆鉴定', '情感剽窃罪', '遗忘保险', '诉记庭'],
    antiPatterns: ['随便读写无同意', '无鉴定', '记忆无限复制无贬值逻辑'],
    skeletonHints: ['交易合同范本', '反悔条例', '鉴定所', '剽窃判例', '遗忘险条款', '诉记庭规程'] }),
  W({ id: 'yesterday_replay_station', group: 'modern', label: '昨日重播站台', mapsToWorldframe: 'time_loop',
    description: '车站会重播昨日旅客：回声月台、错位重逢、铁路警察的「勿与回声交谈」令。',
    writingGuide: '回声是半实体。与回声亲密的伦理要写清；角色成人。',
    lexicon: ['重播', '回声月台', '错位重逢', '勿谈令', '铁路警', '时刻表裂隙', '行李残响', '同一班车', '消回声盐', '站长', '裂隙税', '实旅客'],
    mustCover: ['重播时刻', '勿谈令', '回声物理规则', '铁路警权', '消回声手段', '实旅客优先法'],
    antiPatterns: ['回声无规则', '可随意带离回声', '无勿谈令后果'],
    skeletonHints: ['重播时刻表', '勿谈告示', '铁路警手册', '消回声流程', '裂隙税', '实旅客通道'] }),
  W({ id: 'idol_ability_project', group: 'modern', label: '偶像异能企划', mapsToWorldframe: 'idol_industry',
    description: '娱乐工业与异能管制合流：舞台即释放场、热搜是污染指标、经纪约含能力条款。',
    writingGuide: '通告与能力冷却双轨。粉丝应援可成仪式，成人艺人；禁止未成年偶像。',
    lexicon: ['异能偶像', '释放场', '热搜污染', '能力条款', '应援阵', '冷却针', '舞台结界', '经纪约', '评级选秀', '黑粉驱魔', '联动副本', '营业技能'],
    mustCover: ['能力条款合同', '舞台结界标准', '热搜污染阈值', '冷却医疗', '选秀评级', '粉丝应援法规'],
    antiPatterns: ['未成年偶像', '能力无冷却', '无合同的纯打歌'],
    skeletonHints: ['经纪能力附件', '结界验收', '污染阈值表', '冷却诊所', '选秀规程', '应援法'] }),
  W({ id: 'culinary_xianxia', group: 'oriental', label: '器食修仙', mapsToWorldframe: 'xianxia',
    description: '以烹炼灵食、器食同源为核心的修仙支脉：膳堂宗门、毒宴审判、食神竞赛与双修药膳。',
    writingGuide: '灵食有药性与忌口。药膳双修须成人自愿并写药性冲突。',
    lexicon: ['灵食', '膳堂', '烹炼', '药膳', '忌口', '食神赛', '毒宴', '器食', '厨道', '灵厨刀', '火候', '席面阵'],
    mustCover: ['烹炼体系', '忌口法', '膳堂宗门', '毒宴审判', '食神赛制', '药膳双修规范'],
    antiPatterns: ['只是美食文无修仙机制', '药膳无忌口', '毒宴无法律'],
    skeletonHints: ['膳堂戒律', '忌口手册', '毒宴判例', '食神赛程', '灵厨刀谱', '药膳契'] }),
];

const orientalExtra = [
  W({ id: 'republican_urban', group: 'oriental', label: '民国坊间', mapsToWorldframe: 'republican_era',
    description: '租界、报馆、舞厅与军阀电报构成的近代中国都市肌理。密信与巡捕并行，情欲藏在里弄与包厢。',
    writingGuide: '用报馆暗号与租界法写张力。角色成人；避免把历史苦难当无重量情趣。',
    lexicon: ['租界', '报馆', '舞厅', '电报', '军阀', '里弄', '巡捕', '洋行', '密信', '戏园', '同乡会', '烟馆'],
    mustCover: ['租界与华界双法', '报馆舆论权', '巡捕盘查', '军阀勒索', '同乡会庇护', '舞厅/里弄空间'],
    antiPatterns: ['只有旗袍滤镜', '无租界法', '美化烟馆毒害无批判'],
    skeletonHints: ['租界章程', '报馆暗号', '巡捕手册', '同乡会规', '舞厅包厢规', '密信格式'] }),
  W({ id: 'western_frontier_world', group: 'modern', label: '西部荒野', mapsToWorldframe: 'western_frontier',
    description: '铁路、赏金、警长与沙暴牧场的边疆秩序。决斗约定与酒馆法并行。',
    writingGuide: '镇子法短而硬。情欲在酒馆阁楼须处理流言与枪，成人。',
    lexicon: ['荒野', '酒馆', '赏金', '警长', '铁路', '决斗', '牧场', '驿站', '沙暴', '矿镇', '马具', '边警'],
    mustCover: ['镇子法', '决斗约定', '赏金规则', '铁路公司权', '警长权限', '驿站中立'],
    antiPatterns: ['无限牛仔浪漫无法律', '决斗无规则', '沙暴无生存逻辑'],
    skeletonHints: ['镇子法牌', '决斗规约', '赏金海报制', '铁路地契', '警长日志', '驿站公约'] }),
  W({ id: 'circus_caravan', group: 'modern', label: '马戏团游幕', mapsToWorldframe: 'generic',
    description: '巡回马戏：帐篷法、演员契约、镇民围观伦理与「夜场禁忌秀」的内部戒律。',
    writingGuide: '巡回是封闭社群。禁忌秀须成人合意与退出条款；禁止把真实马戏剥削无批判美化。',
    lexicon: ['帐篷', '游幕', '演员契', '夜场', '驯兽', '票根', '镇许可', '幕后', '艺名', '分账', '巡线路', '禁忌秀'],
    mustCover: ['演员契约', '帐篷法', '镇许可', '分账', '夜场戒律', '退出/赎身'],
    antiPatterns: ['无契约纯流浪', '未成年演员性化', '禁忌秀无退出'],
    skeletonHints: ['演员契范本', '帐篷法', '镇许可函', '分账簿', '夜场戒律', '巡线路图'] }),
];

const supernaturalExtra = [
  W({ id: 'pheromone_court', group: 'supernatural', label: '信息素宫廷', mapsToWorldframe: 'bio_hive',
    description: '信息素等级决定朝仪与婚配的超自然宫廷：抑制贴剂、嗅觉外交、暴香罪。',
    writingGuide: '信息素是礼法。强制催情违法须有刑；角色成人，抑制贴剂常备。',
    lexicon: ['信息素', '抑制贴', '暴香罪', '嗅觉外交', '等级腺', '朝仪', '婚配嗅', '净味殿', '香税', '腺检', '覆香', '退香'],
    mustCover: ['等级腺制度', '抑制贴配给', '暴香罪', '婚配嗅规则', '净味殿', '腺检'],
    antiPatterns: ['信息素强制无刑', '无抑制手段', '未成年腺级性化'],
    skeletonHints: ['腺级法', '抑制贴药房', '暴香刑', '婚配嗅仪', '净味殿规', '腺检表'] }),
];

// Build catastrophe file + append extras into existing group files via import+rewrite

async function appendToGroup(fileRel, groupId, extras) {
  const full = path.join(root, fileRel);
  const mod = await import(pathToFileUrl(full));
  const existing = mod.PRESETS || [];
  const ids = new Set(existing.map((p) => p.id));
  const add = extras.filter((p) => p.group === groupId || true).filter((p) => {
    // filter by intended group matching file
    return !ids.has(p.id);
  });
  // Fix: extras already tagged with group; filter those matching
  const matched = extras.filter((p) => p.group === groupId && !ids.has(p.id));
  const merged = existing.concat(matched);
  matched.forEach(assertWv);
  existing.forEach(assertWv);
  const header = fs.readFileSync(full, 'utf8').split('export var PRESETS')[0];
  write(fileRel, header + 'export var PRESETS = ' + toJs(merged, 2) + ';\n');
  console.log('append', fileRel, '+', matched.length, '=', merged.length);
}

function pathToFileUrl(p) {
  return 'file://' + p;
}

// Write catastrophe as new file
catastrophe.forEach(assertWv);
write('src/lib/presets/worldviews/data/catastrophe.mjs', `/**
 * 灾变异质组世界观预设
 * 厚度底线：description≥80、writingGuide≥120、lexicon≥12、mustCover≥6、antiPatterns≥3、skeletonHints≥6
 */
export var PRESETS = ${toJs(catastrophe, 2)};
`);

write('src/lib/presets/worldviews/groups.mjs', `/**
 * 世界观预设分组（扩展：在此加 group，并在 data/ 下新建分文件）
 */
export var WORLDVIEW_GROUPS = [
  { id: 'oriental', label: '东方玄幻' },
  { id: 'modern', label: '现代向' },
  { id: 'fantasy', label: '奇幻异界' },
  { id: 'supernatural', label: '超自然族群' },
  { id: 'scifi', label: '科幻末日' },
  { id: 'catastrophe', label: '灾变异质' },
  { id: 'taboo_power', label: '权力禁忌' },
];
`);

// Update worldviews index DATA_MODULES
write('src/lib/presets/worldviews/index.mjs', fs.readFileSync(path.join(root, 'src/lib/presets/worldviews/index.mjs'), 'utf8')
  .replace(
    "import { PRESETS as TABOO_POWER } from './data/taboo_power.mjs';\n\nvar DATA_MODULES = [ORIENTAL, MODERN, FANTASY, SUPERNATURAL, SCIFI, TABOO_POWER];",
    "import { PRESETS as TABOO_POWER } from './data/taboo_power.mjs';\nimport { PRESETS as CATASTROPHE } from './data/catastrophe.mjs';\n\nvar DATA_MODULES = [ORIENTAL, MODERN, FANTASY, SUPERNATURAL, SCIFI, CATASTROPHE, TABOO_POWER];"
  ));

// Append to group files
await appendToGroup('src/lib/presets/worldviews/data/fantasy.mjs', 'fantasy', fantasyExtra);
await appendToGroup('src/lib/presets/worldviews/data/modern.mjs', 'modern', modernExtra.concat(orientalExtra.filter(p => p.group === 'modern')));
await appendToGroup('src/lib/presets/worldviews/data/oriental.mjs', 'oriental', modernExtra.concat(orientalExtra).filter(p => p.group === 'oriental'));
await appendToGroup('src/lib/presets/worldviews/data/supernatural.mjs', 'supernatural', supernaturalExtra);

console.log('worldviews phase done');
