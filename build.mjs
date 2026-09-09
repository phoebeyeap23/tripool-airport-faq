#!/usr/bin/env node
/**
 * 把 content/*.yml 編譯成單一檔案 dist/index.html。
 *
 *   node build/build.mjs              → dist/index.html（完整網頁，給 GitHub Pages）
 *   node build/build.mjs --fragment   → 另外輸出 dist/fragment.html（無 <html> 外殼）
 *
 * 建置時會檢查：引用不存在的共用 id、沒代入的 {{變數}}、國家代碼錯誤。
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load as parseYaml } from 'js-yaml';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...s) => path.join(ROOT, ...s);
const read = f => parseYaml(fs.readFileSync(f, 'utf8'));

const warnings = [];
const errors = [];

const site = read(p('content/site.yml'));
const countries = read(p('content/countries.yml'));
const shared = read(p('content/shared.yml'));
const LANGS = site.languages.map(l => l.code);

const sharedNotes = Object.fromEntries((shared.notes || []).map(n => [n.id, n]));
const sharedFaq = Object.fromEntries((shared.faq || []).map(f => [f.id, f]));

/* 把 {{變數}} 換成該機場的值；順便把 {{email}} 之類的全站值也帶進去 */
function interpolate(str, vars, where) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, key) => {
    if (key in vars) return String(vars[key]);
    warnings.push(`${where}：找不到變數 {{${key}}}`);
    return m;
  });
}

const localized = (obj, vars, where) =>
  Object.fromEntries(LANGS.map(l => [l, interpolate(obj?.[l] ?? obj?.[LANGS[0]] ?? '', vars, where)]));

/* 解析 notes / faq 的一筆項目：use 引用共用，或直接自訂 */
function resolveItem(entry, pool, kind, vars, file) {
  const where = `${file} 的 ${kind}`;
  if (entry.use) {
    const base = pool[entry.use];
    if (!base) { errors.push(`${where}：引用了不存在的共用 id「${entry.use}」`); return null; }
    const merged = { ...base, ...entry };
    return finish(merged, kind, vars, `${where}[${entry.use}]`);
  }
  if (!entry.id) warnings.push(`${where}：自訂項目最好加上 id，方便日後追蹤`);
  return finish(entry, kind, vars, `${where}[${entry.id || '?'}]`);
}

function finish(item, kind, vars, where) {
  if (kind === 'notes') return { id: item.id, text: localized(item.text, vars, where) };
  return { id: item.id, q: localized(item.q, vars, where), a: localized(item.a, vars, where) };
}

/* 讀取所有機場（底線開頭的檔案略過，例如 _template.yml） */
const files = fs.readdirSync(p('content/airports'))
  .filter(f => /\.ya?ml$/.test(f) && !f.startsWith('_'))
  .sort();

const airports = {};
const byCountry = {};

for (const file of files) {
  const id = file.replace(/\.ya?ml$/, '');
  const raw = read(p('content/airports', file));
  const vars = { ...(raw.vars || {}), email: site.brand.email };

  if (!countries.some(c => c.code === raw.country))
    errors.push(`${file}：country「${raw.country}」不在 countries.yml 裡`);

  airports[id] = {
    id,
    country: raw.country,
    code: raw.code,
    draft: !!raw.draft,
    updated: raw.updated ? String(raw.updated).slice(0, 10) : '',
    name: raw.name,
    service: raw.service,
    notes: (raw.notes || []).map(e => resolveItem(e, sharedNotes, 'notes', vars, file)).filter(Boolean),
    faq: (raw.faq || []).map(e => resolveItem(e, sharedFaq, 'faq', vars, file)).filter(Boolean),
  };
  (byCountry[raw.country] ||= []).push(id);
}

if (!files.length) errors.push('content/airports/ 裡沒有任何機場檔案');

const data = {
  site,
  countries,
  airports,
  byCountry,
  defaultAirport: Object.keys(airports)[0],
  builtAt: new Date().toISOString(),
};

/* ── 輸出 ─────────────────────────────────────────────── */
const tpl = fs.readFileSync(p('src/page.html'), 'utf8');
const body = tpl.replace('/*__DATA__*/{}', JSON.stringify(data)
  .replace(/<\/script/gi, '<\\/script'));

fs.mkdirSync(p('dist'), { recursive: true });

const full = `<!doctype html>
<html lang="${LANGS[0]}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${site.brand.name} 接送服務注意事項與常見問題">
<meta name="color-scheme" content="light dark">
<link rel="preconnect" href="https://fonts.googleapis.com">
<style>body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>
${body}
</html>`;

fs.writeFileSync(p('dist/index.html'), full);
fs.writeFileSync(p('dist/.nojekyll'), '');
if (process.argv.includes('--fragment')) fs.writeFileSync(p('dist/fragment.html'), body);

/* ── 報告 ─────────────────────────────────────────────── */
const kb = (fs.statSync(p('dist/index.html')).size / 1024).toFixed(1);
const faqCount = Object.values(airports).reduce((n, a) => n + a.faq.length, 0);
console.log(`✓ dist/index.html  ${kb} KB`);
console.log(`  ${files.length} 個機場 / ${Object.keys(byCountry).length} 個國家 / ${faqCount} 則問答 / ${LANGS.join(', ')}`);
const drafts = Object.values(airports).filter(a => a.draft).map(a => a.id);
if (drafts.length) console.log(`  草稿狀態：${drafts.join(', ')}`);
warnings.forEach(w => console.warn(`! ${w}`));
if (errors.length) { errors.forEach(e => console.error(`✗ ${e}`)); process.exit(1); }
