/**
 * CRC32（与 src/lib/utils.mjs 保持一致；服务端部署不含仓库根 src/）
 */
var CRC_TABLE = new Array(256);
for (var c = 0; c < 256; c++) {
  var n = c;
  for (var k = 0; k < 8; k++) n = (n & 1) ? (0xedb88320 ^ (n >>> 1)) : (n >>> 1);
  CRC_TABLE[c] = n;
}

/** @param {Uint8Array|number[]} arr */
export function crc32(arr) {
  var crc = 0 ^ (-1);
  for (var i = 0; i < arr.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ arr[i]) & 0xff];
  return (crc ^ (-1)) >>> 0;
}
