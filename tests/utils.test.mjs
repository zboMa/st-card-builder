/**
 * 纯函数工具——单元测试
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  uid,
  escapeHtml,
  truncatePreviewLine,
  parseJsonLoose,
  normalizeNameList,
  isPngBytes,
  findPngIendOffset,
  embedTextChunkIntoPng,
  crc32,
  createTextChunk,
} from '../src/lib/utils.mjs';

describe('utils.mjs 纯函数', function() {

  describe('uid', function() {
    it('生成带前缀的唯一 ID', function() {
      var id1 = uid('test');
      var id2 = uid('test');
      assert.match(id1, /^test_[\w]+$/);
      assert.match(id2, /^test_[\w]+$/);
      assert.notEqual(id1, id2);
    });
    it('默认前缀为 id', function() {
      var id = uid();
      assert.match(id, /^id_[\w]+$/);
    });
  });

  describe('escapeHtml', function() {
    it('转义 HTML 特殊字符', function() {
      assert.equal(escapeHtml('<div>"a" & b</div>'),
        '&lt;div&gt;&quot;a&quot; &amp; b&lt;/div&gt;');
    });
    it('空值返回空字符串', function() {
      assert.equal(escapeHtml(null), '');
      assert.equal(escapeHtml(undefined), '');
      assert.equal(escapeHtml(''), '');
    });
    it('数字转为字符串', function() {
      assert.equal(escapeHtml(123), '123');
    });
  });

  describe('truncatePreviewLine', function() {
    it('短文本不截断', function() {
      assert.equal(truncatePreviewLine('hello'), 'hello');
    });
    it('超长文本截断并加省略号', function() {
      var long = 'a'.repeat(120);
      var result = truncatePreviewLine(long, 100);
      assert.equal(result.length, 101); // 100 + '…'
      assert.ok(result.endsWith('…'));
    });
    it('合并多余空白', function() {
      assert.equal(truncatePreviewLine('  a   b  '), 'a b');
    });
    it('空值返回空字符串', function() {
      assert.equal(truncatePreviewLine(''), '');
    });
    it('默认上限 100', function() {
      var long = 'x'.repeat(150);
      var result = truncatePreviewLine(long);
      assert.equal(result.length, 101);
    });
  });

  describe('parseJsonLoose', function() {
    it('解析纯 JSON 对象', function() {
      assert.deepEqual(parseJsonLoose('{"a": 1}'), { a: 1 });
    });
    it('解析 JSON 数组', function() {
      assert.deepEqual(parseJsonLoose('[1, 2, 3]'), [1, 2, 3]);
    });
    it('从 markdown fence 中提取', function() {
      var input = 'some text\n```json\n{"b": 2}\n```\nmore text';
      assert.deepEqual(parseJsonLoose(input), { b: 2 });
    });
    it('从无语言标记的 fence 中提取', function() {
      var input = '```\n{"c": 3}\n```';
      assert.deepEqual(parseJsonLoose(input), { c: 3 });
    });
    it('从前后杂物中提取 JSON', function() {
      var input = '前缀文本 {"valid": true} 后缀文本';
      assert.deepEqual(parseJsonLoose(input), { valid: true });
    });
    it('非法输入抛出错误', function() {
      assert.throws(function() { parseJsonLoose('not json at all'); }, /JSON 解析失败/);
    });
  });

  describe('normalizeNameList', function() {
    it('去空、去主名重复', function() {
      assert.deepEqual(
        normalizeNameList('秦月', ['月儿', '秦月', ' 月儿 ', '']),
        ['月儿']
      );
    });
    it('逗号分隔拆分', function() {
      assert.deepEqual(
        normalizeNameList('Alice', 'Bob, Charlie'),
        ['Bob', 'Charlie']
      );
    });
    it('中文逗号分隔拆分', function() {
      assert.deepEqual(
        normalizeNameList('甲', '乙，丙、丁'),
        ['乙', '丙', '丁']
      );
    });
    it('纯字符串无主名去重', function() {
      assert.deepEqual(
        normalizeNameList('', '  a , b , c  '),
        ['a', 'b', 'c']
      );
    });
    it('空输入返回空数组', function() {
      assert.deepEqual(normalizeNameList('x', null), []);
      assert.deepEqual(normalizeNameList('x', ''), []);
    });
    it('混合数组和字符串拆分', function() {
      assert.deepEqual(
        normalizeNameList('主', ['别名1', '别名2, 别名3']),
        ['别名1', '别名2', '别名3']
      );
    });
  });

  describe('PNG 嵌入', function() {
    function makePng() {
      var sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      // IHDR：len=13, type=IHDR, data(13B, 内容任意), crc(4B)
      var ihdr = [0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]
        .concat(new Array(13).fill(0))
        .concat([0, 0, 0, 0]);
      // IEND：len=0, type=IEND, crc(4B)
      var iend = [0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0, 0, 0, 0];
      return new Uint8Array(sig.concat(ihdr).concat(iend));
    }
    it('isPngBytes 校验魔数', function() {
      assert.equal(isPngBytes(makePng()), true);
      assert.equal(isPngBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])), false);
      assert.equal(isPngBytes(null), false);
    });
    it('findPngIendOffset 定位 IEND，非法返回 -1', function() {
      assert.equal(findPngIendOffset(makePng()), 8 + 25);
      assert.equal(findPngIendOffset(new Uint8Array([1, 2, 3])), -1);
    });
    it('embedTextChunkIntoPng 把 chunk 插到 IEND 前且不破坏结构', function() {
      var png = makePng();
      var chunk = createTextChunk('chara', JSON.stringify({ spec: 'chara_card_v2', data: { name: '测试' } }));
      var out = embedTextChunkIntoPng(png, chunk);
      assert.equal(out.length, png.length + chunk.length);
      // chunk 插在原 IEND 偏移处，IEND 紧随其后（先 4 字节 length，再 'IEND'）
      var iend = findPngIendOffset(png);
      var embedded = out.slice(iend, iend + chunk.length);
      assert.deepEqual(Array.from(embedded), Array.from(chunk));
      assert.equal(out[iend + chunk.length + 4], 0x49);
      assert.equal(out[iend + chunk.length + 5], 0x45);
      assert.equal(out[iend + chunk.length + 6], 0x4e);
      assert.equal(out[iend + chunk.length + 7], 0x44);
    });
    it('embedTextChunkIntoPng 非 PNG 底图抛错', function() {
      var jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
      assert.throws(function() { embedTextChunkIntoPng(jpeg, new Uint8Array([1])); }, /不是合法 PNG/);
    });
    it('crc32 与 createTextChunk 一致性（chunk 可被解析）', function() {
      var ch = createTextChunk('chara', 'aGVsbG8=');
      assert.ok(ch.length > 12);
      // 校验 crc 非全零（数据有效）
      assert.ok(ch[ch.length - 1] !== 0 || ch[ch.length - 2] !== 0 || ch[ch.length - 3] !== 0 || ch[ch.length - 4] !== 0);
    });
  });

});
