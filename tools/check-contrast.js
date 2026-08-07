#!/usr/bin/env node
//
// check-contrast.js -- verify the palette in assets/style.css meets WCAG.
//
//   node tools/check-contrast.js
//
// The values are read out of the stylesheet rather than restated here, so this
// check cannot drift from what the site actually serves. It reads the two
// explicit theme blocks, :root[data-theme="light"] and :root[data-theme="dark"],
// which is why those blocks must restate every token rather than inheriting.
//
// Thresholds (WCAG 2.1):
//   1.4.3 Contrast (Minimum)      4.5:1 for body text
//   1.4.11 Non-text Contrast      3:1 for meaningful non-text marks
//
// --rule is deliberately not checked. It draws hairline dividers, which are
// decorative separators rather than marks needed to identify a control, and
// 1.4.11 does not apply to them. Making it pass 3:1 would turn every card
// outline into a hard box.

'use strict';

const fs = require('fs');
const path = require('path');

const CSS = path.resolve(__dirname, '..', 'assets', 'style.css');

// A selector may appear more than once -- the theme tokens and the system
// colours are separate blocks on purpose. Merge every block that uses it, in
// source order, so later declarations win exactly as the cascade would.
function blockOf(css, selector) {
  const out = {};
  let found = 0;
  let at = 0;
  for (;;) {
    const start = css.indexOf(selector, at);
    if (start === -1) break;
    // Skip a longer selector that merely starts with this one, e.g.
    // ':root[data-theme="light"] .foo'.
    const open = css.indexOf('{', start);
    if (open === -1) break;
    const between = css.slice(start + selector.length, open).trim();
    at = open + 1;
    if (between !== '') continue;
    const close = css.indexOf('}', open);
    if (close === -1) throw new Error(`unterminated block: ${selector}`);
    found++;
    const body = css.slice(open + 1, close);
    const re = /--([\w-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g;
    let m;
    while ((m = re.exec(body))) out[m[1]] = m[2];
    at = close + 1;
  }
  if (!found) throw new Error(`selector not found: ${selector}`);
  return out;
}

const hex2rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
const lin = c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lum = h => { const [r, g, b] = hex2rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

function ratio(a, b) {
  const l1 = lum(a), l2 = lum(b);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const css = fs.readFileSync(CSS, 'utf8');
let failures = 0;

function check(theme, label, fg, bg, need) {
  const r = ratio(fg, bg);
  const ok = r >= need;
  if (!ok) failures++;
  console.log('  %s %s  %s (need %s:1)',
    ok ? 'ok  ' : 'FAIL', r.toFixed(2).padStart(5), label.padEnd(38), need);
}

for (const theme of ['light', 'dark']) {
  const p = blockOf(css, `:root[data-theme="${theme}"]`);
  console.log('\n== %s ==', theme);

  for (const bg of ['ground', 'surface', 'surface-2']) {
    check(theme, `ink on ${bg}`, p.ink, p[bg], 4.5);
    check(theme, `ink-dim on ${bg}`, p['ink-dim'], p[bg], 4.5);
  }

  // The two signal colours carry meaning as text, so they need the text floor.
  for (const bg of ['ground', 'surface']) {
    check(theme, `pass on ${bg}`, p.pass, p[bg], 4.5);
    check(theme, `debug on ${bg}`, p.debug, p[bg], 4.5);
  }

  // System colours are non-text marks: dots, rules down the side of a card.
  for (const [name, value] of Object.entries(p)) {
    if (!name.startsWith('os-')) continue;
    check(theme, `${name} on surface`, value, p.surface, 3);
  }
}

console.log('\n%d failure(s)', failures);
process.exit(failures ? 1 : 0);
