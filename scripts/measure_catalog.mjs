// 口径：/catalog 首屏 HTML 字节 + modern JS（排除 nomodule，属性大小写不敏感）
// 用法：node scripts/measure_catalog.mjs [path]
const base = "http://localhost:5000";
const path = process.argv[2] || "/catalog";

async function sizeOf(url) {
  const res = await fetch(url);
  const buf = Buffer.from(await res.arrayBuffer());
  return buf.length;
}

const htmlRes = await fetch(base + path);
const htmlBuf = Buffer.from(await htmlRes.arrayBuffer());
const html = htmlBuf.toString("utf8");

// 抓所有 <script ... src="..."> ；记录是否带 nomodule（大小写不敏感）
const scriptRe = /<script\b[^>]*>/gi;
const srcRe = /src="([^"]+)"/i;
const nomoduleRe = /\bnomodule\b/i;
let modern = [];
let legacy = [];
for (const m of html.match(scriptRe) ?? []) {
  const s = m.match(srcRe);
  if (!s) continue;
  const src = s[1];
  if (!src.includes("/_next/static/chunks/")) continue;
  if (nomoduleRe.test(m)) legacy.push(src);
  else modern.push(src);
}

let modernBytes = 0;
const detail = [];
for (const src of modern) {
  const b = await sizeOf(base + src);
  modernBytes += b;
  detail.push(`  ${src.split("/").pop()}  ${b.toLocaleString()} B`);
}

console.log(`== ${path} ==`);
console.log(`HTML: ${htmlBuf.length.toLocaleString()} bytes (${(htmlBuf.length / 1024).toFixed(1)} KiB)`);
console.log(`modern JS chunks: ${modern.length}, total ${modernBytes.toLocaleString()} bytes (${(modernBytes / 1024).toFixed(1)} KiB, ${(modernBytes / 1048576).toFixed(3)} MB)`);
console.log(`nomodule chunks excluded: ${legacy.length}`);
console.log(detail.join("\n"));
