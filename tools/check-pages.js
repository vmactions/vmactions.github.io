#!/usr/bin/env node
//
// check-pages.js -- structural checks the browser will not shout about.
//
//   node tools/check-pages.js
//
// Catches the failures that look fine on screen:
//   - a duplicate id, which silently breaks whichever anchor loses
//   - an internal link pointing at an id or a file that does not exist
//   - an input documented on the site that action.yml does not have, or an
//     input action.yml has that the site never documents
//   - a bilingual node with only one half, which vanishes when the reader
//     switches language
//   - a byte-order mark, which breaks tooling on both sides of the boundary

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const ACTION_YML = path.resolve(ROOT, '..', 'base-vm', 'action.yml');

const PAGES = ['index.html', 'docs/inputs.html', '404.html'];

let failures = 0;
function fail(msg) { failures++; console.log('  FAIL  ' + msg); }
function ok(msg) { console.log('  ok    ' + msg); }

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }

function idsOf(html) {
  const ids = [];
  const re = /\sid="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) ids.push(m[1]);
  return ids;
}

/* ------------------------------------------------- duplicate ids */

console.log('\n== ids ==');
const idsByPage = {};
for (const page of PAGES) {
  const ids = idsOf(read(page));
  idsByPage[page] = new Set(ids);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) fail(`${page}: duplicate id ${[...new Set(dupes)].join(', ')}`);
  else ok(`${page}: ${ids.length} ids, all unique`);
}

/* ------------------------------------------------- internal links */

console.log('\n== internal links ==');
for (const page of PAGES) {
  const html = read(page);
  const re = /href="(\/[^"#]*)?(#[^"]*)?"/g;
  let m, checked = 0;
  while ((m = re.exec(html))) {
    const file = m[1];
    const hash = m[2] ? m[2].slice(1) : '';
    let targetPage = page;

    if (file) {
      let rel = file.replace(/^\//, '');
      if (rel === '' ) rel = 'index.html';
      if (!fs.existsSync(path.join(ROOT, rel))) {
        fail(`${page}: links to missing file ${file}`);
        continue;
      }
      targetPage = rel;
    }
    if (hash) {
      const known = idsByPage[targetPage];
      if (!known) continue;                       // page not in the checked set
      if (!known.has(hash)) fail(`${page}: #${hash} does not exist in ${targetPage}`);
    }
    checked++;
  }
  ok(`${page}: ${checked} internal links resolve`);
}

/* ------------------------------------------------- input coverage */

console.log('\n== inputs documented ==');
const yml = fs.readFileSync(ACTION_YML, 'utf8');
const inputsBlock = yml.slice(yml.indexOf('inputs:'), yml.indexOf('outputs:'));
const declared = [...inputsBlock.matchAll(/^ {2}([a-z][a-z0-9-]*):$/gm)].map(m => m[1]);

const docIds = idsByPage['docs/inputs.html'];
const missing = declared.filter(name => !docIds.has(name));
const extra = [...docIds].filter(id =>
  !declared.includes(id) && !['outputs', 'custom-shell'].includes(id) &&
  !id.startsWith('lang-') && !id.startsWith('theme-'));

if (missing.length) fail(`action.yml inputs never documented: ${missing.join(', ')}`);
else ok(`all ${declared.length} action.yml inputs are documented`);

if (extra.length) fail(`documented but not in action.yml: ${extra.join(', ')}`);
else ok('no invented inputs');

/* ------------------------------------------------- bilingual halves */

console.log('\n== bilingual halves ==');
for (const page of PAGES) {
  const html = read(page);
  // Require the preceding whitespace: data-lang="en" contains lang="en" as a
  // substring and would otherwise be counted as a content node.
  const en = (html.match(/\slang="en"/g) || []).length;
  const zh = (html.match(/\slang="zh"/g) || []).length;
  // <html lang="en"> accounts for exactly one unpaired en.
  if (en - 1 !== zh) fail(`${page}: ${en - 1} en nodes vs ${zh} zh nodes`);
  else ok(`${page}: ${zh} pairs`);
}

/* ------------------------------------------------- byte-order marks */

console.log('\n== encoding ==');
function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const bommed = walk(ROOT, []).filter(file => {
  const head = fs.readFileSync(file).subarray(0, 3);
  return head[0] === 0xEF && head[1] === 0xBB && head[2] === 0xBF;
});

if (bommed.length) fail('BOM found in: ' + bommed.map(f => path.relative(ROOT, f)).join(', '));
else ok('no BOM anywhere');

console.log('\n%d failure(s)', failures);
process.exit(failures ? 1 : 0);
