import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_GENERATION_INSTRUCTION,
  LONG_PROSE_CHARS,
  STOCK_CHAR_DESC,
  STOCK_GREETING,
  STOCK_WB,
  longFormToolError,
  isLongFormGuardError,
  redirectLongFormCall,
  buildRelationIndex,
  buildGenerationPack,
  formatAdultModeLine,
  relationMentionWarning,
} from '../src/lib/assistant/generationContext.mjs';

describe('generation context', function() {
  it('库存生成提示达到门槛', function() {
    assert.ok(STOCK_CHAR_DESC.length >= MIN_GENERATION_INSTRUCTION);
    assert.ok(STOCK_GREETING.length >= MIN_GENERATION_INSTRUCTION);
    assert.ok(STOCK_WB.length >= MIN_GENERATION_INSTRUCTION);
  });

  it('长文工具缺少生成提示时拒绝', function() {
    var err = longFormToolError('expand_character_field', { field: 'charDesc', instruction: '写丰富一点' });
    assert.match(err, /生成提示/);
    assert.equal(longFormToolError('expand_greeting', { target: 'main', instruction: STOCK_GREETING }), '');
  });

  it('一次写完的草稿和骨架工具被拒绝', function() {
    assert.match(longFormToolError('generate_character_draft', {}), /逐篇生成/);
    assert.match(longFormToolError('generate_worldbook_skeleton', { count: 8 }), /逐篇生成/);
  });

  it('长正文不能从写入参数直接落卡', function() {
    var prose = '场'.repeat(LONG_PROSE_CHARS);
    assert.match(longFormToolError('create_worldbook_entry', {
      entry: { comment: '林月', content: prose },
    }), /长正文/);
    assert.equal(longFormToolError('create_worldbook_entry', {
      entry: { comment: '林月', content: '剑修，与宗门对立。' },
    }), '');
    assert.match(longFormToolError('update_character_fields', {
      fields: { charDesc: prose },
    }), /expand_character_field/);
    assert.equal(longFormToolError('update_character_fields', {
      fields: { charName: '青云' },
    }), '');
  });

  it('长正文在调用时改成生成工具，短字段单独留下', function() {
    var prose = '场'.repeat(LONG_PROSE_CHARS);
    var redirected = redirectLongFormCall('update_character_fields', {
      fields: { charName: '青云', charDesc: prose, creatorNotes: prose + '注' },
    });
    assert.equal(redirected.tool, 'expand_character_field');
    assert.equal(redirected.args.field, 'charDesc');
    assert.match(redirected.args.instruction, /不要原样存成正文/);
    assert.ok(redirected.args.instruction.length >= MIN_GENERATION_INSTRUCTION);
    assert.equal(redirected.shortCall.tool, 'update_character_fields');
    assert.deepEqual(redirected.shortCall.args.fields, { charName: '青云' });
    assert.match(redirected.followup, /作者注释/);
    assert.equal(redirectLongFormCall('update_character_fields', {
      fields: { charName: '青云', tags: ['奇幻'] },
    }), null);
  });

  it('世界书长正文改去生成或重写，不把正文当已写入的 content', function() {
    var prose = '条'.repeat(LONG_PROSE_CHARS);
    var created = redirectLongFormCall('create_worldbook_entry', {
      entry: { comment: '顾清辞', content: prose, keys: ['顾清辞'] },
    });
    assert.equal(created.tool, 'generate_worldbook_entry');
    assert.match(created.args.instruction, /顾清辞/);
    assert.equal(created.args.content, undefined);
    var rewritten = redirectLongFormCall('update_worldbook_entry', {
      target: { index: 2 },
      patch: { keys: ['顾清辞'], content: prose },
    });
    assert.equal(rewritten.tool, 'rewrite_worldbook_entry');
    assert.equal(rewritten.args.target.index, 2);
    assert.deepEqual(rewritten.shortCall.args.patch, { keys: ['顾清辞'] });
    assert.equal(isLongFormGuardError(longFormToolError('update_character_fields', {
      fields: { charDesc: prose },
    })), true);
    assert.equal(isLongFormGuardError('条目未找到'), false);
  });

  it('关联索引按类型分组，并抽出被点名的正文', function() {
    var rel = buildRelationIndex([
      { comment: '林月', content: '外门剑修，持有青霜剑。', keys: ['林月', '师姐'], outlineType: 'person' },
      { comment: '青霜剑', content: '林月的佩剑。', keys: ['青霜'], outlineType: 'item' },
      { comment: '禁地', content: '后山禁地。', keys: ['后山'], outlineType: 'location' },
    ], { focusText: '写林月如何拔出青霜剑' });
    assert.match(rel.indexText, /人物/);
    assert.match(rel.indexText, /物品/);
    assert.match(rel.indexText, /地点/);
    assert.match(rel.relatedText, /林月/);
    assert.match(rel.relatedText, /青霜剑/);
    assert.match(rel.rule, /平行卡司/);
  });

  it('生成包把本次任务、世界与限定和关联放在一起', function() {
    var pack = buildGenerationPack({
      instruction: STOCK_WB,
      worldviewHint: '【世界观预设·仙侠】宗门礼法',
      adultHints: { ntl: '【NTL】权力差' },
      entries: [{ comment: '林月', content: '剑修', keys: ['林月'], outlineType: 'person' }],
      character: { charName: '青云', charDesc: '宗门大比前夜' },
      focusTitle: '青霜剑',
    });
    assert.match(pack, /本次任务/);
    assert.match(pack, /世界与限定/);
    assert.match(pack, /仙侠/);
    assert.match(pack, /NTL/);
    assert.match(pack, /已有关联/);
    assert.match(pack, /场景契约摘要/);
  });

  it('生成包带上当前成人开关', function() {
    var pack = buildGenerationPack({
      instruction: STOCK_WB,
      adultHints: { gate: formatAdultModeLine(true, false) },
    });
    assert.match(pack, /AdultMode=true/);
    assert.match(pack, /NtlMode=false/);
    assert.match(formatAdultModeLine(false, true), /AdultMode=false/);
    assert.match(formatAdultModeLine(false, true), /NtlMode=true/);
  });

  it('未点名已有人物时给出 linkWarning', function() {
    var warn = relationMentionWarning('一条与谁都无关的设定。', [
      { comment: '林月', content: '剑修', keys: ['师姐'], outlineType: 'person' },
    ]);
    assert.match(warn, /林月/);
    assert.equal(relationMentionWarning('林月拔剑。', [
      { comment: '林月', content: '剑修', outlineType: 'person' },
    ]), '');
  });
});
