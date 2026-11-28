// 校验仓库里的构建产物 dist/server/index.js 与构建脚本从源码算出的 bundle 是否一致。
// 只做比较、不写盘，可安全地在 CI、pre-commit 或本地任意时刻运行。
// 行尾先归一化为 LF，因此在 Windows 与 Linux 上结论相同（Git 的 autocrlf 不会造成假失败）。
import {readFileSync} from 'node:fs';
import {bundle} from '../build.mjs';

const artifact = new URL('../dist/server/index.js', import.meta.url);
const normalize = text => text.replace(/\r\n?/g, '\n');

let onDisk;
try {
  onDisk = normalize(readFileSync(artifact, 'utf8'));
} catch (error) {
  console.error('verify-bundle: 读不到 dist/server/index.js，请先运行 `node build.mjs`。');
  console.error(String(error && error.message || error));
  process.exit(1);
}

const built = normalize(bundle().code);

if (built === onDisk) {
  console.log(`bundle in sync (${Buffer.byteLength(onDisk, 'utf8')} bytes)`);
  process.exit(0);
}

// 只报告位置与长度，不打印大段产物（单行 bundle 动辄几十万字符）。
let offset = 0;
const limit = Math.min(built.length, onDisk.length);
while (offset < limit && built[offset] === onDisk[offset]) offset++;
const lineOf = text => text.slice(0, offset).split('\n').length;
const preview = text => JSON.stringify(text.slice(offset, offset + 40));
console.error('bundle out of sync');
console.error(`  首个差异偏移: ${offset} (第 ${lineOf(onDisk)} 行)`);
console.error(`  源 bundle:     ${built.length} 字符`);
console.error(`  磁盘产物:      ${onDisk.length} 字符`);
console.error(`  bundle 片段:   ${preview(built)}`);
console.error(`  产物片段:      ${preview(onDisk)}`);
console.error('  产物已过期：运行 `node build.mjs` 重新生成后提交 dist/server/index.js。');
process.exit(1);
