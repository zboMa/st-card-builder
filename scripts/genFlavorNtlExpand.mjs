/**
 * 口味 + NTL 扩目录（三件套）
 * node scripts/genFlavorNtlExpand.mjs
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
  fs.writeFileSync(path.join(root, rel), content);
  console.log('write', rel);
}

function flavor(id, group, label, description, palette, focus, avoid, en, ov) {
  return { id, group, label, description, palette, focus, avoid, en, ov };
}

const ADULT = '限已完成设定成年礼的成人；须可协商、可中断；禁止儿童性化。';

// ─── 异质物质组（核心）────────────────────────────────
const matterFlavors = [
  flavor('tentacle', '异质物质', '触手向',
    '触手缠缚、多点触碰与非人节奏——强调同意口令、解缠与呼吸；' + ADULT,
    { temperature: '湿冷→热', texture: '柔韧粘滑', primary_intensity_default: 0.85, accent_intensity_default: 0.7 },
    ['entwine', 'multi_point_touch', 'nonhuman_rhythm', 'safe_word_release', 'aftercare_unwind'],
    ['无同意强制缠死', '无解缠机制', '儿童性化'],
    {
      mustCover: ['同意/解缠口令', '缠缚节奏与呼吸', '非人触感差异', '解除后的安抚清理'],
      writingGuide: '触手是感官与权力的延伸，不是无脑暴行。口令优先；解开与清理必须写完。' + ADULT,
      antiPatterns: ['无同意默认浪漫', '无解缠', '只有触手堆砌无心理'],
      densityHint: 320,
      signals: ['触手', '缠缚', '口令', '解缠', '粘液', '多点', '呼吸'],
    },
    {
      mustCover: ['可公证的解缠口令器物', '缠缚场所的分区与退出通道', '清理粘液的药剂/清洗间'],
      writingGuide: '世界要提供解缠信物与清洗设施，禁止只有缠没有退。',
      antiPatterns: ['无退出的永久缠死装置当唯一玩法'],
      signals: ['口令', '解缠', '清洗', '分区', '信物'],
    }),
  flavor('bodily_fluids', '异质物质', '体液向',
    '汗、泪、涎、爱液等体液作为感官与标记语言——脏与亲昵并存，重清理与合意；' + ADULT,
    { temperature: '体温湿', texture: '黏潮', primary_intensity_default: 0.75, accent_intensity_default: 0.8 },
    ['fluid_marking', 'taste_scent', 'mess_intimacy', 'cleanup_care', 'consent_boundaries'],
    ['无同意强迫吞咽', '病理羞辱无安抚', '儿童性化'],
    {
      mustCover: ['体液如何成为标记/亲昵语言', '合意边界（可/不可）', '感官（味嗅触）', '事后清理与情绪安抚'],
      writingGuide: '写质地与气味，不写侮辱人格的纯脏贬。清理是爱或仪式的一部分。' + ADULT,
      antiPatterns: ['无边界强迫', '只有脏无亲密', '病理化羞辱无修复'],
      densityHint: 300,
      signals: ['体液', '汗', '标记', '清理', '气味', '黏', '合意'],
    },
    {
      mustCover: ['清洗间/换衣规则', '可接受的标记范围条例', '清洁药剂或沐浴设施'],
      writingGuide: '载体提供可清洗、可限制范围的物质条件。',
      antiPatterns: ['无清洁设施的强制弄脏'],
      signals: ['清洗', '标记范围', '药剂', '沐浴'],
    }),
  flavor('oviposition_play', '异质物质', '产卵暗示向',
    '虚构产卵/孕育道具的填充与排出节奏——明确虚构合意、可取出、非真实生育强迫；' + ADULT,
    { temperature: '温胀', texture: '卵壳光滑', primary_intensity_default: 0.8, accent_intensity_default: 0.65 },
    ['fullness', 'insertion_removal', 'ritual_gestation_fiction', 'aftercare_check', 'safe_toys'],
    ['真实非自愿妊娠强迫美化', '儿童性化', '无取出机制'],
    {
      mustCover: ['虚构合意与可停止', '填充—排出节奏', '取出/检查安全', '事后身体与情绪护理'],
      writingGuide: '写成可逆的道具/异能仪式，不是强制生育宣传。取出与检查必须出现。' + ADULT,
      antiPatterns: ['无取出', '美化强制妊娠', '忽略安全检查'],
      densityHint: 320,
      signals: ['卵', '填充', '排出', '取出', '检查', '虚构', '合意'],
    },
    {
      mustCover: ['可取出的卵形器物规格', '检查与取出的医疗/仪式场所', '停止口令等价物'],
      writingGuide: '载体必须支持取出与中止，禁止不可逆强制孕育装置当甜宠。',
      antiPatterns: ['不可取出的永久植入当默认'],
      signals: ['取出', '规格', '检查', '口令', '中止'],
    }),
  flavor('slime', '异质物质', '粘液向',
    '凝胶包裹、半溶解触感与滑腻束缚——中和剂在场，清洁律可执行；' + ADULT,
    { temperature: '凉滑→体温', texture: '凝胶', primary_intensity_default: 0.7, accent_intensity_default: 0.75 },
    ['encase', 'slippery_restraint', 'dissolve_edge', 'neutralizer', 'cleanup'],
    ['非自愿溶解伤害美化', '无中和剂', '儿童性化'],
    {
      mustCover: ['包裹/滑腻的具体触感', '中和剂与停止条件', '呼吸与视野是否被妨碍', '清洁与皮肤护理'],
      writingGuide: '粘液是材质与节奏。危险边缘要有中和剂。' + ADULT,
      antiPatterns: ['无中和剂的溶解伤害', '只写黏无心理', '非自愿伤害当甜'],
      densityHint: 300,
      signals: ['粘液', '凝胶', '包裹', '中和', '滑', '清洁'],
    },
    {
      mustCover: ['中和剂配给点', '清洁律相关设施', '包裹可解除的机关'],
      writingGuide: '市政级清洁与中和必须存在。',
      antiPatterns: ['无解除机关的永久凝胶牢'],
      signals: ['中和剂', '清洁', '解除', '机关'],
    }),
  flavor('pheromone', '异质物质', '信息素向',
    '气味等级、抑制贴与暴香失控——催情须合意，抑制手段常备；' + ADULT,
    { temperature: '热嗅', texture: '空气薄麝', primary_intensity_default: 0.8, accent_intensity_default: 0.7 },
    ['scent_rank', 'inhibitor_patch', 'consensual_surge', 'withdrawal', 'after_scent_care'],
    ['强制暴香迷奸', '无抑制贴', '儿童性化'],
    {
      mustCover: ['信息素如何改变判断', '抑制/解除手段', '合意催情 vs 违规暴香', '事后嗅觉与情绪平复'],
      writingGuide: '气味是权力也是药。强制催情必须作违规写代价。' + ADULT,
      antiPatterns: ['迷奸默认浪漫', '无抑制', '气味决定一切无反抗'],
      densityHint: 310,
      signals: ['信息素', '抑制', '暴香', '气味', '合意', '平复'],
    },
    {
      mustCover: ['抑制贴/净味场所', '暴香罪相关条例物证', '嗅觉检测装置'],
      writingGuide: '世界提供抑制与执法，不只是「很香」。',
      antiPatterns: ['无抑制物资'],
      signals: ['抑制贴', '净味', '检测', '条例'],
    }),
  flavor('body_morph', '异质物质', '变形躯体向',
    '临时变形、尺寸/肢干变化带来的陌生自我——可逆、可暂停、镜像确认；' + ADULT,
    { temperature: '变异热', texture: '皮肤改写', primary_intensity_default: 0.75, accent_intensity_default: 0.7 },
    ['temporary_morph', 'self_recognition', 'reversible', 'pause_safe', 'mirror_check'],
    ['永久非自愿致残美化', '无回滚', '儿童性化'],
    {
      mustCover: ['变形触发与范围', '可逆/暂停条件', '自我认知冲击', '回滚后的安抚'],
      writingGuide: '陌生身体是情欲也是恐慌。回滚按钮必须存在。' + ADULT,
      antiPatterns: ['永久非自愿致残当甜', '无回滚', '忽略自我认知'],
      densityHint: 310,
      signals: ['变形', '回滚', '暂停', '镜像', '陌生', '可逆'],
    },
    {
      mustCover: ['回滚药剂/装置', '变形许可证件', '镜像确认室'],
      writingGuide: '许可与回滚是公共基础设施。',
      antiPatterns: ['无回滚的永久改造刑具当默认情趣'],
      signals: ['回滚', '许可', '镜像', '药剂'],
    }),
  flavor('nonhuman_orifice', '异质物质', '非人孔窍向',
    '异种生理腔道/开口的设定驱动亲密——解剖差异要写清，安全与润滑优先；' + ADULT,
    { temperature: '异温', texture: '非人黏膜', primary_intensity_default: 0.8, accent_intensity_default: 0.75 },
    ['anatomy_diff', 'lubrication_safety', 'species_pace', 'education_consent', 'aftercare'],
    ['无视解剖的硬套伤害', '无润滑安全', '儿童性化'],
    {
      mustCover: ['解剖差异说明', '润滑与安全节奏', '合意与教学式试探', '事后护理'],
      writingGuide: '设定决定体验，禁止人形换皮。安全与教学感优先于暴力。' + ADULT,
      antiPatterns: ['无视解剖硬上', '无润滑', '只有猎奇无护理'],
      densityHint: 320,
      signals: ['解剖', '润滑', '异种', '安全', '护理', '试探'],
    },
    {
      mustCover: ['物种生理手册类载体', '专用润滑/适配器物', '护理室'],
      writingGuide: '世界提供适配说明与护理，不是只有猎奇。',
      antiPatterns: ['无适配说明的伤害器具'],
      signals: ['手册', '润滑', '适配', '护理'],
    }),
  flavor('symbiosis_parasite', '异质物质', '共生寄生向',
    '共生体/寄生感的满胀与低语——区分合意共生与侵害；可剥离条款必写；' + ADULT,
    { temperature: '内热', texture: '脉动共生', primary_intensity_default: 0.85, accent_intensity_default: 0.7 },
    ['shared_pulse', 'inner_voice', 'consensual_bond', 'detach_clause', 'identity_border'],
    ['非自愿寄生永久控制美化', '无剥离', '儿童性化'],
    {
      mustCover: ['共生 vs 侵害的界限', '内在感受/低语', '剥离条款与执行', '自我边界如何保持'],
      writingGuide: '合意共生可写亲密；侵害须有反抗与代价，不可当无批判甜宠。' + ADULT,
      antiPatterns: ['永久精神控制当浪漫', '无剥离', '抹杀自我无重量'],
      densityHint: 320,
      signals: ['共生', '寄生', '剥离', '低语', '边界', '合意'],
    },
    {
      mustCover: ['剥离仪式/药剂', '共生契约文书', '自我边界检测'],
      writingGuide: '契约与剥离必须可执行。',
      antiPatterns: ['不可剥离的永久寄生当默认恋爱'],
      signals: ['剥离', '契约', '检测', '药剂'],
    }),
];

// 补强其他组
const moreFlavors = [
  flavor('obsession', '情绪基调', '痴恋向',
    '病态专注与反复确认——占有欲与脆弱并存，须写停损与成人合意；' + ADULT,
    { temperature: '灼热', texture: '烙印', primary_intensity_default: 0.85, accent_intensity_default: 0.8 },
    ['fixation', 'reassurance_loop', 'jealous_watch', 'soft_crash', 'boundary_talk'],
    ['跟踪伤害无批判', '无停损', '儿童性化'],
    { mustCover: ['痴恋如何显形', '确认/嫉妒循环', '停损或外部介入', '事后崩溃与安抚'], writingGuide: '痴恋是双刃。停损与边界谈话要出现。' + ADULT, antiPatterns: ['跟踪美化无代价', '无停损', '忽略崩溃'], densityHint: 300, signals: ['痴恋', '确认', '嫉妒', '停损', '崩溃'] },
    { mustCover: ['可切断的监视信物规则', '冷静期场所', '边界协议物证'], writingGuide: '世界提供冷静期与切断机制。', antiPatterns: ['不可关闭的监控当甜宠'], signals: ['切断', '冷静期', '协议'] }),
  flavor('vengeful_desire', '情绪基调', '报复欲向',
    '情欲与报复纠缠——快感里有清算，须写清伤害伦理与是否和解；' + ADULT,
    { temperature: '冷笑的热', texture: '刃', primary_intensity_default: 0.8, accent_intensity_default: 0.75 },
    ['score_settling', 'ironic_tenderness', 'power_flip', 'aftermath_reckoning', 'consent_gray_explicit'],
    ['无批判的纯虐报复爽', '儿童性化'],
    { mustCover: ['报复动机', '情欲中的清算动作', '对方是否知情同意', '事后伦理账'], writingGuide: '若写强迫须黑暗有重量；合意报复游戏须事先谈。' + ADULT, antiPatterns: ['无伦理账的虐报复', '强迫当甜'], densityHint: 310, signals: ['报复', '清算', '知情', '翻转', '伦理'] },
    { mustCover: ['可记录的旧怨信物', '翻转权力的场所规则', '和解或永裂的仪式'], writingGuide: '旧怨要物证化。', antiPatterns: ['无动机的随机施暴'], signals: ['旧怨', '信物', '翻转', '和解'] }),
  flavor('awe_dread_lust', '情绪基调', '敬畏恐惧欲',
    '神圣/恐怖对象引发的战栗情欲——跪与颤是情感不是无脑虐；' + ADULT,
    { temperature: '寒战发热', texture: '圣布+暗', primary_intensity_default: 0.7, accent_intensity_default: 0.85 },
    ['kneel_awe', 'sacred_dread', 'trembling_desire', 'permission_ask', 'gentle_descend'],
    ['无同意神权强奸美化', '儿童性化'],
    { mustCover: ['敬畏来源', '战栗的身体细节', '请求许可的仪式', '恐惧后的安放'], writingGuide: '神性压力下仍要许可。' + ADULT, antiPatterns: ['神权强制当浪漫', '只有怕没有欲'], densityHint: 300, signals: ['敬畏', '战栗', '许可', '跪', '安放'] },
    { mustCover: ['请愿仪式器物', '可拒绝的神谕结构', '安放场所'], writingGuide: '拒绝必须可能。', antiPatterns: ['不可拒绝的神谕强奸机关'], signals: ['请愿', '拒绝', '安放'] }),
  flavor('protocol_slave', '关系动态', '契约主奴向',
    '书面契约界定的主奴角色扮演——条款、时限、安全词、定期复核；' + ADULT,
    { temperature: '仪式温', texture: '革+纸', primary_intensity_default: 0.75, accent_intensity_default: 0.6 },
    ['written_contract', 'role_hours', 'safeword', 'review', 'aftercare'],
    ['无契约无时限的永久奴役美化', '儿童性化'],
    { mustCover: ['书面条款要点', '时限与安全词', '定期复核', '角色外的平等安抚'], writingGuide: '主奴是可撤销的扮演结构。' + ADULT, antiPatterns: ['无安全词永久奴', '无复核'], densityHint: 310, signals: ['契约', '安全词', '时限', '复核', '主奴'] },
    { mustCover: ['可销毁的契约文本', '安全词信物', '复核日程装置'], writingGuide: '文本可毁、词可喊。', antiPatterns: ['不可毁永契当唯一'], signals: ['文本', '信物', '复核'] }),
  flavor('public_protocol', '关系动态', '公开服从向',
    '在约定观众/规则下的公开服从——曝光范围先谈妥；' + ADULT,
    { temperature: '聚光热', texture: '舞台', primary_intensity_default: 0.7, accent_intensity_default: 0.8 },
    ['agreed_audience', 'protocol_display', 'shame_arousal', 'exit_plan', 'debrief'],
    ['非约定公开羞辱', '儿童性化'],
    { mustCover: ['观众范围约定', '服从指令内容', '退出计划', '事后复盘安抚'], writingGuide: '公开是协议不是突袭。' + ADULT, antiPatterns: ['突袭公开', '无退出', '无复盘'], densityHint: 300, signals: ['公开', '观众', '服从', '退出', '复盘'] },
    { mustCover: ['可关闭的展示场', '观众准入名单', '紧急降下幕布机制'], writingGuide: '幕布必须降得下来。', antiPatterns: ['无降下的永久曝光台'], signals: ['名单', '幕布', '准入'] }),
  flavor('group_power_field', '关系动态', '多人权力场',
    '三人以上权力差与注视结构——焦点、轮转、否决权写清；' + ADULT,
    { temperature: '群热', texture: '多层目光', primary_intensity_default: 0.8, accent_intensity_default: 0.7 },
    ['focus_rotate', 'veto_right', 'gaze_hierarchy', 'coalition', 'aftercare_all'],
    ['无否决的轮奸美化', '儿童性化'],
    { mustCover: ['谁主导谁否决', '注视与轮转规则', '每个参与者的事后安抚', '退出权'], writingGuide: '多人不是混沌。否决与退出优先。' + ADULT, antiPatterns: ['无否决轮奸当甜', '忽略某人安抚'], densityHint: 320, signals: ['多人', '否决', '轮转', '注视', '退出'] },
    { mustCover: ['否决信物', '轮转计时', '多人安抚空间'], writingGuide: '否决信物人人可见。', antiPatterns: ['无否决机制的围场'], signals: ['否决', '计时', '安抚空间'] }),
  flavor('bondage_focus', '特殊风味', '束缚向',
    '绳/铐/固着带来的动线限制——循环检查血运与安全剪在场；' + ADULT,
    { temperature: '紧压', texture: '绳纤', primary_intensity_default: 0.75, accent_intensity_default: 0.65 },
    ['restraint_geometry', 'circulation_check', 'safety_shears', 'helpless_trust', 'release_ritual'],
    ['无检查的危险吊缚伤害', '儿童性化'],
    { mustCover: ['束缚方式与着力点', '血运/神经检查', '安全剪与快速解开', '解开仪式与安抚'], writingGuide: '美服从属于安全。检查与剪刀必须在场。' + ADULT, antiPatterns: ['无检查危险吊', '无剪刀', '解开后不理'], densityHint: 300, signals: ['束缚', '检查', '安全剪', '解开', '信任'] },
    { mustCover: ['安全剪固定位置', '束缚点设计规范', '解开后护理站'], writingGuide: '场所预装安全。', antiPatterns: ['无剪的死结刑架当情趣'], signals: ['安全剪', '规范', '护理'] }),
  flavor('pain_edge', '特殊风味', '疼痛边缘向',
    '协商的疼痛阈值与停止协议——痛是对话不是发泄；' + ADULT,
    { temperature: '锐热', texture: '鞭痕', primary_intensity_default: 0.85, accent_intensity_default: 0.6 },
    ['negotiated_intensity', 'traffic_light', 'pain_as_dialogue', 'mark_care', 'emotional_check'],
    ['无协商施暴', '儿童性化'],
    { mustCover: ['事前协商强度', '红黄绿灯', '疼痛中的情感确认', '伤痕护理与复盘'], writingGuide: '疼痛必须可刹停。' + ADULT, antiPatterns: ['无灯乱打', '忽略护理', '施暴发泄'], densityHint: 310, signals: ['疼痛', '绿灯', '刹停', '护理', '协商'] },
    { mustCover: ['强度量表物证', '刹停铃', '护理药膏与记录'], writingGuide: '铃与药膏是基础设施。', antiPatterns: ['无刹停铃的刑具房'], signals: ['量表', '铃', '药膏'] }),
  flavor('sacrilege', '特殊风味', '圣渎向',
    '神圣符号被情欲征用的亵渎张力——尊重真实宗教伤害，偏重虚构教团；' + ADULT,
    { temperature: '烛火', texture: '圣布撕开', primary_intensity_default: 0.7, accent_intensity_default: 0.85 },
    ['sacred_symbol', 'transgression_thrill', 'guilt_pleasure', 'fictional_cult', 'after_confession'],
    ['针对真实宗教群体的仇恨色情', '儿童性化'],
    { mustCover: ['虚构神圣符号', '亵渎动作的心理账', '愧疚与快感', '事后告解或决裂'], writingGuide: '优先虚构教团；避免真实宗教仇恨化。' + ADULT, antiPatterns: ['真实宗教仇恨色情', '无心理账'], densityHint: 300, signals: ['圣', '亵渎', '愧疚', '告解', '符号'] },
    { mustCover: ['虚构圣器', '告解室规则', '可逆的符号污损清理'], writingGuide: '污损可清理，避免不可逆亵渎真实圣地。', antiPatterns: ['鼓励现实破坏宗教场所'], signals: ['圣器', '告解', '清理'] }),
  flavor('objectification_prop', '特殊风味', '物化器物向',
    '约定时间内把人当器物使用的角色框架——人格暂停有时限，事后必须复位；' + ADULT,
    { temperature: '物冷', texture: '瓷/金属', primary_intensity_default: 0.8, accent_intensity_default: 0.7 },
    ['timed_object_role', 'use_and_reset', 'safeword_override', 'dignity_return', 'debrief'],
    ['永久物化无复位', '儿童性化'],
    { mustCover: ['时限与安全词覆盖', '使用方式边界', '复位仪式', '尊严回归谈话'], writingGuide: '物化是限时扮演。复位强制。' + ADULT, antiPatterns: ['永久物化', '无复位', '无安全词'], densityHint: 310, signals: ['物化', '时限', '复位', '安全词', '尊严'] },
    { mustCover: ['计时器', '复位袍/更衣', '安全词灯'], writingGuide: '计时结束自动提醒复位。', antiPatterns: ['无计时永久陈列'], signals: ['计时', '复位', '灯'] }),
  flavor('uniform_ritual', '特殊风味', '制服仪式向',
    '更衣、衔级、礼仪动作构成的制服情欲——制服属作成人职业/军警/礼仪设定；' + ADULT,
    { temperature: '浆烫', texture: '布料纹章', primary_intensity_default: 0.65, accent_intensity_default: 0.7 },
    ['dressing_ritual', 'rank_gesture', 'fabric_sound', 'role_voice', 'undress_reverse'],
    ['校服未成年性化', '儿童性化'],
    { mustCover: ['更衣仪式步骤', '衔级/礼仪动作', '布料与声音细节', '脱卸的反向仪式'], writingGuide: '明确成人制服。禁止校服未成年意象。' + ADULT, antiPatterns: ['校服未成年性化', '只有衣服无仪式'], densityHint: 290, signals: ['制服', '更衣', '衔级', '礼仪', '脱卸'] },
    { mustCover: ['更衣间规则', '衔级标识器物', '成人制服库（非校服）'], writingGuide: '库存与标识必须成人职业向。', antiPatterns: ['未成年校服库存'], signals: ['更衣间', '衔级', '成人制服'] }),
  flavor('scent_focus', '感官节奏', '气味向',
    '以气味记忆与气味标记主导的节奏——香水、体香、空间气味层；' + ADULT,
    { temperature: '嗅觉热', texture: '空气丝', primary_intensity_default: 0.6, accent_intensity_default: 0.8 },
    ['scent_memory', 'layering', 'mark_space', 'inhale_focus', 'air_out'],
    ['强制熏迷无同意', '儿童性化'],
    { mustCover: ['气味层次', '记忆触发', '空间标记', '散味与事后'], writingGuide: '嗅觉镜头要细。强制迷香作违规。' + ADULT, antiPatterns: ['迷香强奸默认', '只有「好香」'], densityHint: 290, signals: ['气味', '记忆', '标记', '吸入', '散味'] },
    { mustCover: ['通风/散味装置', '许可香品清单', '禁迷香条例'], writingGuide: '通风是安全设施。', antiPatterns: ['密闭强制迷香室当甜'], signals: ['通风', '清单', '禁令'] }),
  flavor('taste_focus', '感官节奏', '味觉向',
    '吻与喂食、酒与药的味道节奏——可拒食，过敏表事先交换；' + ADULT,
    { temperature: '舌温', texture: '汁液', primary_intensity_default: 0.65, accent_intensity_default: 0.7 },
    ['feed_kiss', 'flavor_pair', 'refuse_right', 'allergy_list', 'aftertaste_care'],
    ['强迫灌食', '儿童性化'],
    { mustCover: ['味道与质地', '拒食权', '过敏/忌口', '余味护理'], writingGuide: '喂食是亲密不是强迫。' + ADULT, antiPatterns: ['强迫灌食', '无视过敏'], densityHint: 280, signals: ['味', '喂', '拒食', '过敏', '余味'] },
    { mustCover: ['忌口卡片', '可拒的喂食器物', '清水/漱口站'], writingGuide: '忌口卡先于喂食。', antiPatterns: ['无视忌口的灌食器'], signals: ['忌口', '清水', '拒'] }),
  flavor('voice_command', '感官节奏', '听觉指令向',
    '声音、口令与耳语控制节奏——可静音否决，指令集预先备案；' + ADULT,
    { temperature: '耳廓热', texture: '声纹', primary_intensity_default: 0.7, accent_intensity_default: 0.75 },
    ['command_set', 'whisper', 'mute_veto', 'tone_drop', 'debrief_voice'],
    ['强制洗脑无否决', '儿童性化'],
    { mustCover: ['指令集范围', '静音/否决', '声线变化', '事后用正常声音复盘'], writingGuide: '指令是游戏不是洗脑。' + ADULT, antiPatterns: ['无否决洗脑', '事后仍剥夺声音'], densityHint: 290, signals: ['指令', '耳语', '否决', '声线', '复盘'] },
    { mustCover: ['指令备案板', '静音否决铃', '复盘对讲'], writingGuide: '备案可见，铃可按。', antiPatterns: ['无否决的强制耳麦'], signals: ['备案', '铃', '对讲'] }),
  flavor('blank_out', '感官节奏', '失神空白向',
    '过载后的短暂失神与被捞回——空白可怖也可甜，捞回协议必备；' + ADULT,
    { temperature: '空白冷', texture: '雾', primary_intensity_default: 0.85, accent_intensity_default: 0.7 },
    ['overload', 'blank_moment', 'retrieve_protocol', 'grounding', 'hydrate_warm'],
    ['故意致昏迷伤害无护理', '儿童性化'],
    { mustCover: ['过载触发', '失神表现', '捞回步骤', '着陆安抚补水'], writingGuide: '失神不是丢弃。捞回强制。' + ADULT, antiPatterns: ['丢弃失神者', '无捞回', '故意伤害昏迷'], densityHint: 300, signals: ['失神', '空白', '捞回', '着陆', '补水'] },
    { mustCover: ['捞回口令卡', '保温毯与补水点', '过载熔断装置'], writingGuide: '熔断与毯子是标配。', antiPatterns: ['无熔断的过载刑'], signals: ['熔断', '毯子', '口令卡'] }),
];

const allFlavors = matterFlavors.concat(moreFlavors);

// Build matter presets file + append files for other groups
const matterPresets = {};
const matterEn = {};
const allOv = {};
for (const f of allFlavors) {
  if (f.group === '异质物质') {
    matterPresets[f.id] = {
      group: f.group, label: f.label, description: f.description,
      palette: f.palette, focus: f.focus, avoid: f.avoid,
    };
    matterEn[f.id] = f.en;
  }
  allOv[f.id] = f.ov;
}

write('src/lib/adult/flavors/presets/matter.mjs', `/** 口味·异质物质（触手/体液/粘液等） */\nexport var PRESETS = ${toJs(matterPresets, 2)};\n`);
write('src/lib/adult/flavors/enrichment/matter.mjs', `/** 丰满规范·异质物质 */\nexport var ENRICHMENT = ${toJs(matterEn, 2)};\n`);

write('src/lib/adult/flavors/groups.mjs', `export var FLAVOR_GROUPS = [
  { id: '情绪基调', label: '情绪基调' },
  { id: '关系动态', label: '关系动态' },
  { id: '特殊风味', label: '特殊风味' },
  { id: '感官节奏', label: '感官节奏' },
  { id: '异质物质', label: '异质物质' },
];
`);

write('src/lib/adult/flavors/presets/catalog.mjs', `import { PRESETS as emotion } from './emotion.mjs';
import { PRESETS as relation } from './relation.mjs';
import { PRESETS as special } from './special.mjs';
import { PRESETS as sensory } from './sensory.mjs';
import { PRESETS as matter } from './matter.mjs';

/** 合并口味预设（含异质物质） */
export var NSFW_FLAVOR_PRESETS = Object.assign({}, emotion, relation, special, sensory, matter);
`);

write('src/lib/adult/flavors/enrichment/catalog.mjs', `import { ENRICHMENT as emotion } from './emotion.mjs';
import { ENRICHMENT as relation } from './relation.mjs';
import { ENRICHMENT as special } from './special.mjs';
import { ENRICHMENT as sensory } from './sensory.mjs';
import { ENRICHMENT as matter } from './matter.mjs';

/** 合并口味丰满规范 */
export var NSFW_FLAVOR_ENRICHMENT = Object.assign({}, emotion, relation, special, sensory, matter);
`);

// Append non-matter flavors into existing group files
async function appendFlavorGroup(presetRel, enRel, groupName, list) {
  const items = list.filter((f) => f.group === groupName);
  if (!items.length) return;
  const presetPath = path.join(root, presetRel);
  const enPath = path.join(root, enRel);
  let presetMod = await import('file://' + presetPath + '?t=' + Date.now());
  let enMod = await import('file://' + enPath + '?t=' + Date.now());
  const presets = { ...presetMod.PRESETS };
  const ens = { ...enMod.ENRICHMENT };
  for (const f of items) {
    presets[f.id] = {
      group: f.group, label: f.label, description: f.description,
      palette: f.palette, focus: f.focus, avoid: f.avoid,
    };
    ens[f.id] = f.en;
  }
  const pHead = fs.readFileSync(presetPath, 'utf8').split('export var PRESETS')[0];
  const eHead = fs.readFileSync(enPath, 'utf8').split('export var ENRICHMENT')[0];
  write(presetRel, pHead + 'export var PRESETS = ' + toJs(presets, 2) + ';\n');
  write(enRel, eHead + 'export var ENRICHMENT = ' + toJs(ens, 2) + ';\n');
  console.log('flavor append', groupName, items.length);
}

await appendFlavorGroup('src/lib/adult/flavors/presets/emotion.mjs', 'src/lib/adult/flavors/enrichment/emotion.mjs', '情绪基调', moreFlavors);
await appendFlavorGroup('src/lib/adult/flavors/presets/relation.mjs', 'src/lib/adult/flavors/enrichment/relation.mjs', '关系动态', moreFlavors);
await appendFlavorGroup('src/lib/adult/flavors/presets/special.mjs', 'src/lib/adult/flavors/enrichment/special.mjs', '特殊风味', moreFlavors);
await appendFlavorGroup('src/lib/adult/flavors/presets/sensory.mjs', 'src/lib/adult/flavors/enrichment/sensory.mjs', '感官节奏', moreFlavors);

// Append overlays to flavor.mjs
const flavorOvPath = path.join(root, 'src/lib/adult/vessels/overlays/flavor.mjs');
let flavorOvText = fs.readFileSync(flavorOvPath, 'utf8');
// insert before final `};` of FLAVOR_VESSEL_OVERLAYS - the last `};` before end
const ovInsert = Object.keys(allOv).map((id) => {
  return '  ' + id + ': ' + toJs(allOv[id], 4).replace(/\n/g, '\n  ') + ',';
}).join('\n');
if (!flavorOvText.includes('tentacle:')) {
  flavorOvText = flavorOvText.replace(/\n\};\n\s*$/, '\n' + ovInsert + '\n};\n');
  write('src/lib/adult/vessels/overlays/flavor.mjs', flavorOvText);
}

// ─── NTL ────────────────────────────────────────────────────
function ntl(id, group, label, description, en, ov) {
  return { id, group, label, description, en, ov };
}

const newNtl = [
  ntl('mentor_disciple', 'bond', '师徒越界',
    '师徒/传功名分下的越界张力。双方须为已完成世界观成年礼的成人；禁止儿童性化。礼法可写拜师年岁，不得以幼徒情欲开脱。',
    { mustCover: ['师徒名分如何构成禁忌', '传功/教习名义的伪装', '被同门或宗门发现的代价', '双方如何合理化越界'], writingGuide: '教习场景进机制。成年礼已完成是硬前提。', antiPatterns: ['幼徒性化', '无宗门代价'], densityHint: 300, signals: ['师徒', '传功', '名分', '越界', '宗门'] },
    { mustCover: ['拜师帖/传功器物', '教习场所门禁', '宗门处分条例物证'], writingGuide: '名分器物化。', antiPatterns: ['无师门结构的普通乱伦标签'], signals: ['拜师', '传功', '处分'] }),
  ntl('doctor_patient_ethic', 'bond', '医患伦理',
    '诊疗关系中的伦理越界。患者与医者均须成人；知情同意被情欲污染时要写执照风险。禁止儿童患者性化。',
    { mustCover: ['诊疗权力差', '知情同意如何被侵蚀或守护', '执照/投诉风险', '事后伦理账'], writingGuide: '专业边界崩塌要有重量。', antiPatterns: ['儿童患者', '无执照后果的美化'], densityHint: 300, signals: ['医患', '知情同意', '执照', '边界'] },
    { mustCover: ['病历权限', '约束带/诊帘规则', '投诉与伦理委员会路径'], writingGuide: '医疗器物双义。', antiPatterns: ['无医疗逻辑刑具'], signals: ['病历', '诊帘', '伦理委员会'] }),
  ntl('fan_idol_bond', 'bond', '粉丝偶像',
    '粉丝与偶像的不对称亲密越界。偶像须成人艺人；禁止未成年偶像性化。',
    { mustCover: ['不对称信息与权力', '营业/私下界限', '曝光与私生代价', '合意或崩溃路径'], writingGuide: '营业不等于私约。', antiPatterns: ['未成年偶像', '私生美化无代价'], densityHint: 290, signals: ['粉丝', '偶像', '营业', '私生', '曝光'] },
    { mustCover: ['应援物/后台通行证', '私生跟踪的反制安检', '解约公关'], writingGuide: '通告与安检进机制。', antiPatterns: ['无行业结构'], signals: ['后台', '安检', '公关'] }),
  ntl('pow_asylum', 'bond', '战俘收留',
    '战争/冲突后收留战俘产生的依附与禁忌。双方成人；须写国际法或设定法对战俘的保护与违反代价。',
    { mustCover: ['战俘法律地位', '收留动机', '依附与强制的边界', '战后清算风险'], writingGuide: '黑暗可写，但保护条款与违反代价要在。', antiPatterns: ['无法律的纯虐俘', '儿童战俘性化'], densityHint: 310, signals: ['战俘', '收留', '依附', '清算', '保护'] },
    { mustCover: ['战俘登记牌', '收留宅规则', '军法/国际法条款抄本'], writingGuide: '登记与军法可见。', antiPatterns: ['无登记的黑牢当甜'], signals: ['登记', '军法', '收留'] }),
  ntl('workplace_quid', 'coercion', '职场潜规则',
    '升迁/合同交换身体的胁迫结构。双方成人；须写劳动法或设定法反抗与证据链。',
    { mustCover: ['交换条件', '把柄与证据', '反抗或妥协路径', '组织包庇或惩罚'], writingGuide: '潜规则是系统问题。禁止当无批判甜宠。', antiPatterns: ['美化性贿赂无代价', '儿童'], densityHint: 300, signals: ['潜规则', '升迁', '把柄', '证据', '包庇'] },
    { mustCover: ['合同附件陷阱', '监控/录音证据位', '举报箱或形同虚设的制度'], writingGuide: '证据位要设计。', antiPatterns: ['无系统的个人色狼脸谱'], signals: ['合同', '证据', '举报'] }),
  ntl('occupation_zone', 'coercion', '战争占领区',
    '占领军与居民的权力胁迫。成人角色；须写占领法、抵抗与人道主义底线是否被践踏及后果。',
    { mustCover: ['占领法令', '物资控制', '抵抗或合作的道德账', '战后审判阴影'], writingGuide: '禁止美化战争性暴力；若写须有重量与代价。', antiPatterns: ['战争强奸无批判娱乐化', '儿童'], densityHint: 320, signals: ['占领', '军令', '抵抗', '物资', '审判'] },
    { mustCover: ['通行证', '宵禁哨', '军法处'], writingGuide: '占领靠证件与宵禁运转。', antiPatterns: ['无占领制度的乱兵清单'], signals: ['通行证', '宵禁', '军法'] }),
  ntl('drug_leverage', 'coercion', '药物依赖杠杆',
    '成瘾剂/特效药供应造成的胁迫。成人；写戒断、医疗救助与供应者罪责。',
    { mustCover: ['药物如何成为杠杆', '戒断表现', '救助或更深依赖', '供应者代价'], writingGuide: '成瘾是病与暴政，不是情趣调料。', antiPatterns: ['美化下药迷奸无批判', '儿童'], densityHint: 310, signals: ['成瘾', '戒断', '供应', '杠杆', '救助'] },
    { mustCover: ['药剂编号', '戒断病房', '供应链打击点'], writingGuide: '编号可追责。', antiPatterns: ['无追责的魔法迷药'], signals: ['编号', '病房', '供应链'] }),
  ntl('opinion_kidnap', 'coercion', '舆论绑架',
    '热搜、匿名检举、道德审判逼迫就范。成人；写公关、证据与自杀舆论的禁忌处理需谨慎。',
    { mustCover: ['舆论武器形态', '被逼选择', '公关或塌房', '真实亲密是否被污染'], writingGuide: '镜头与帖文是刑具。', antiPatterns: ['无传播机制的空喊舆论', '儿童'], densityHint: 290, signals: ['舆论', '热搜', '检举', '公关', '塌房'] },
    { mustCover: ['匿名帖传播链', '公关危机手册', '证据保存箱'], writingGuide: '传播链可画出来。', antiPatterns: ['无媒介的空舆论'], signals: ['传播', '公关', '证据箱'] }),
  ntl('cuckold_structure', 'rupture', '绿帽结构',
    '知情/半知情的第三者插入既有关系。三方成人；写规则、羞辱仪式是否合意、关系是否重构。',
    { mustCover: ['知情程度', '规则或突袭', '羞辱与爱的账本', '关系重构或毁灭'], writingGuide: '合意绿帽与伤害绿帽必须区分。', antiPatterns: ['非合意羞辱无重量', '儿童'], densityHint: 300, signals: ['绿帽', '知情', '第三者', '规则', '重构'] },
    { mustCover: ['规则文书或信物', '观看/回避的空间设计', '事后三方谈话场所'], writingGuide: '空间服务观看政治。', antiPatterns: ['无规则的突袭伤害当唯一'], signals: ['规则', '空间', '三方'] }),
  ntl('public_punishment_culture', 'rupture', '公开处刑文化',
    '以公开惩罚维护秩序的社会——情欲化处刑须极度谨慎，写观众、法与创伤。成人；禁止美化真实酷刑娱乐。',
    { mustCover: ['法律程序是否存在', '观众结构', '创伤与性化的危险纠缠', '废除或巩固派'], writingGuide: '若写性化处刑必须批判重量，不可无脑爽。', antiPatterns: ['酷刑色情无批判', '儿童'], densityHint: 320, signals: ['处刑', '公开', '观众', '法', '创伤'] },
    { mustCover: ['法场规制', '观众席等级', '医疗救护是否允许'], writingGuide: '法场是制度建筑。', antiPatterns: ['无法场的巷打'], signals: ['法场', '观众席', '救护'] }),
  ntl('memory_rewrite', 'rupture', '记忆篡改失认',
    '记忆被改导致不认爱人/自我。成人；写同意篡改 vs 侵害、回滚证据。',
    { mustCover: ['篡改手段', '失认表现', '谁受益', '回滚或永失'], writingGuide: '记忆权是人权。非自愿篡改须有罪责。', antiPatterns: ['随意洗脑无代价', '儿童'], densityHint: 310, signals: ['记忆', '篡改', '失认', '回滚', '罪责'] },
    { mustCover: ['神经柜/咒印', '回滚备份', '非法篡改罪条文'], writingGuide: '备份与罪法并行。', antiPatterns: ['无备份的永久洗脑甜宠'], signals: ['备份', '罪法', '咒印'] }),
  ntl('faked_death_return', 'rupture', '替身假死归来',
    '假死/替身暴露后的关系地震。成人；写继承、葬礼谎言与重逢清算。',
    { mustCover: ['假死动机', '替身或空位如何运行', '归来揭露', '信任能否重建'], writingGuide: '葬礼谎言有连带受害者。', antiPatterns: ['无动机的狗血假死', '儿童'], densityHint: 300, signals: ['假死', '替身', '归来', '揭露', '信任'] },
    { mustCover: ['假死亡证明', '替身契约', '揭露物证'], writingGuide: '文书与替身契是核心。', antiPatterns: ['无文书的肥皂剧'], signals: ['死亡证明', '替身契', '物证'] }),
  ntl('breeding_politics', 'rupture', '生育政治撕裂',
    '强制配额/禁生/血统政策撕开亲密。成人；写身体自主与国家/宗族冲突。禁止儿童性化与强制未成年生育。',
    { mustCover: ['生育政策内容', '对亲密的侵入', '反抗或顺从', '身体自主话语'], writingGuide: '政策是反派也可是迷雾。身体自主优先叙述。', antiPatterns: ['强制未成年生育', '无政策的空谈生子'], densityHint: 310, signals: ['生育政策', '配额', '自主', '宗族', '反抗'] },
    { mustCover: ['配额证', '查验机构', '地下避孕网络'], writingGuide: '证件政治。', antiPatterns: ['无机构的空政策'], signals: ['配额证', '查验', '地下'] }),
  ntl('confession_blackmail_faith', 'coercion', '告解勒索',
    '以告解/把柄信仰内容勒索。成人；写神权与隐私。',
    { mustCover: ['告解如何泄密', '勒索条件', '信仰崩塌或举报', '教团包庇与否'], writingGuide: '圣礼被武器化要有程序。', antiPatterns: ['无教团结构', '儿童'], densityHint: 290, signals: ['告解', '勒索', '泄密', '信仰', '教团'] },
    { mustCover: ['告解室隔音作伪', '教廷法庭', '密档柜'], writingGuide: '密档是核心。', antiPatterns: ['无密档的空口勒索'], signals: ['告解室', '密档', '法庭'] }),
];

async function appendNtl(typeRel, enRel, group, list) {
  const items = list.filter((x) => x.group === group);
  const typePath = path.join(root, typeRel);
  const enPath = path.join(root, enRel);
  const types = { ...(await import('file://' + typePath + '?t=' + Date.now())).TYPES };
  const ens = { ...(await import('file://' + enPath + '?t=' + Date.now())).ENRICHMENT };
  for (const n of items) {
    types[n.id] = { label: n.label, description: n.description, group: n.group };
    ens[n.id] = n.en;
  }
  const tHead = fs.readFileSync(typePath, 'utf8').split('export var TYPES')[0];
  const eHead = fs.readFileSync(enPath, 'utf8').split('export var ENRICHMENT')[0];
  write(typeRel, tHead + 'export var TYPES = ' + toJs(types, 2) + ';\n');
  write(enRel, eHead + 'export var ENRICHMENT = ' + toJs(ens, 2) + ';\n');
  console.log('ntl', group, '+', items.length);
}

await appendNtl('src/lib/adult/ntl/types/bond.mjs', 'src/lib/adult/ntl/enrichment/bond.mjs', 'bond', newNtl);
await appendNtl('src/lib/adult/ntl/types/coercion.mjs', 'src/lib/adult/ntl/enrichment/coercion.mjs', 'coercion', newNtl);
await appendNtl('src/lib/adult/ntl/types/rupture.mjs', 'src/lib/adult/ntl/enrichment/rupture.mjs', 'rupture', newNtl);

// NTL overlays append
const ntlOvPath = path.join(root, 'src/lib/adult/vessels/overlays/ntl.mjs');
let ntlOvText = fs.readFileSync(ntlOvPath, 'utf8');
const ntlOvInsert = newNtl.map((n) => '  ' + n.id + ': ' + toJs(n.ov, 4).replace(/\n/g, '\n  ') + ',').join('\n');
if (!ntlOvText.includes('mentor_disciple:')) {
  // insert before NTL_OVERLAY_ALIASES comment block - before the closing }; of overlays
  ntlOvText = ntlOvText.replace(
    /\n\};\n\n\/\*\*\n \* 旧 NTL overlay/,
    '\n' + ntlOvInsert + '\n};\n\n/**\n * 旧 NTL overlay'
  );
  write('src/lib/adult/vessels/overlays/ntl.mjs', ntlOvText);
}

console.log('flavor count new', allFlavors.length, 'ntl new', newNtl.length);
