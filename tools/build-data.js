#!/usr/bin/env node
//
// build-data.js -- derive the coverage matrix from the sibling *-vm checkouts
// and inject it into the site as static HTML.
//
//   node tools/build-data.js            regenerate the site
//   node tools/build-data.js --print    print the derived matrix, write nothing
//
// Nothing here runs in the browser. The site must stay readable with
// JavaScript disabled, so the matrix, the system cards and the counters are
// written into index.html as real markup between marker comments.
// assets/data.js is emitted as well, but only feeds the hero's decorative
// animation.
//
// Every fact on the site comes from the repositories:
//
//   conf/*.conf                    releases, and the arch of each
//   conf/default.release.conf      DEFAULT_RELEASE
//   .github/data/sync-map.json     sync methods per arch
//   .github/data/datafile.ini      display name, shell note, prepare example,
//                                  the upstream builder URL, and the brand
//                                  icon (VM_BRAND_ICON)
//   README.md                      the action's major version
//
// Nothing is typed in from memory. If a value is not in the repositories, it
// does not go on the site.

'use strict';

const fs = require('fs');
const path = require('path');

// Where the *-vm checkouts live, relative to this repository.
const SIBLINGS = path.resolve(__dirname, '..', '..');

// Architecture suffixes, in display order. x86_64 is deliberately absent: it
// is the implicit arch of a conf with no suffix, never a suffix itself.
// Anything not in this list is part of the release name -- GhostBSD ships
// "26.1-xfce", Solaris ships "11.4-gcc-14", and neither is an architecture.
const ARCHES = ['aarch64', 'riscv64', 'powerpc64', 'sparc64', 'ppc64le', 's390x', 'i386', 'loongarch64', 'armv7'];

// Columns of the matrix, x86_64 first.
const COLUMNS = ['x86_64'].concat(ARCHES);

// Display order on the page. Anything not listed sorts after, alphabetically,
// so a newly added *-vm still appears without editing this file.
const ORDER = [
  'freebsd-vm', 'openbsd-vm', 'netbsd-vm', 'dragonflybsd-vm',
  'ghostbsd-vm', 'midnightbsd-vm', 'nextbsd-vm',
  'solaris-vm', 'omnios-vm', 'openindiana-vm', 'tribblix-vm',
  'haiku-vm', 'hurd-vm', 'ubuntu-vm', 'openeuler-vm', 'blissos-vm',
  'reactos-vm', 'redox-vm', 'riscos-vm', 'plan9-vm',
];

// VM_NAME in datafile.ini is written for the generated READMEs and does not
// always match how the project spells itself. The site uses the project's own
// spelling.
const DISPLAY_NAME = {
  'dragonflybsd-vm': 'DragonFly BSD',
  'hurd-vm': 'GNU Hurd',
  'openeuler-vm': 'openEuler',
  'blissos-vm': 'BlissOS',
  'redox-vm': 'Redox OS',
  'riscos-vm': 'RISC OS',
  'plan9-vm': 'Plan 9',
};

// Inner markup of the Feather icons named by each repo's VM_BRAND_ICON --
// the same icon the action wears on the GitHub Marketplace. Copied verbatim
// from the feather-icons dist icons.json (MIT, feathericons/feather on
// GitHub), never written from memory: a hand-typed path renders as garbage,
// not as an error. Rendered inline because the site loads no external
// resources; the stroke takes the row's --os-color via currentColor.
const FEATHER = {
  server: '<rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line>',
  wind: '<path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path>',
  cloud: '<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"></path>',
  moon: '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line>',
  sun: '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>',
  sunrise: '<path d="M17 18a5 5 0 0 0-10 0"></path><line x1="12" y1="2" x2="12" y2="9"></line><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"></line><line x1="1" y1="18" x2="3" y2="18"></line><line x1="21" y1="18" x2="23" y2="18"></line><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"></line><line x1="23" y1="22" x2="1" y2="22"></line><polyline points="8 6 12 2 16 6"></polyline>',
  sunset: '<path d="M17 18a5 5 0 0 0-10 0"></path><line x1="12" y1="9" x2="12" y2="2"></line><line x1="4.22" y1="10.22" x2="5.64" y2="11.64"></line><line x1="1" y1="18" x2="3" y2="18"></line><line x1="21" y1="18" x2="23" y2="18"></line><line x1="18.36" y1="11.64" x2="19.78" y2="10.22"></line><line x1="23" y1="22" x2="1" y2="22"></line><polyline points="16 5 12 9 8 5"></polyline>',
  compass: '<circle cx="12" cy="12" r="10"></circle><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"></polygon>',
  feather: '<path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"></path><line x1="16" y1="8" x2="2" y2="22"></line><line x1="17.5" y1="15" x2="9" y2="15"></line>',
  smartphone: '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline>',
  cpu: '<rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y2="9"></line><line x1="1" y1="14" x2="4" y2="14"></line>',
  aperture: '<circle cx="12" cy="12" r="10"></circle><line x1="14.31" y1="8" x2="20.05" y2="17.94"></line><line x1="9.69" y1="8" x2="21.17" y2="8"></line><line x1="7.38" y1="12" x2="13.12" y2="2.06"></line><line x1="9.69" y1="16" x2="3.95" y2="6.06"></line><line x1="14.31" y1="16" x2="2.83" y2="16"></line><line x1="16.62" y1="12" x2="10.88" y2="21.94"></line>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line>',
};

// Bilingual labels used in the generated markup.
const T = {
  system: { en: 'System', zh: '系统' },
  arch: { en: 'Architecture', zh: '架构' },
  defaultRelease: { en: 'Default release', zh: '默认版本' },
  arches: { en: 'Architectures', zh: '支持架构' },
  sync: { en: 'Sync', zh: '同步方式' },
  shell: { en: 'Shell', zh: '默认 shell' },
  prepare: { en: 'prepare example', zh: 'prepare 示例' },
  systems: { en: 'systems', zh: '个系统' },
  architectures: { en: 'architectures', zh: '种架构' },
  combinations: { en: 'OS-arch combinations', zh: '个系统-架构组合' },
  matrixNote: {
    en: 'Each cell lists the sync methods that combination supports.',
    zh: '每个格子列出该组合支持的同步方式。',
  },
  repo: { en: 'Repository', zh: '仓库' },
  builder: { en: 'Image builder', zh: '镜像 builder' },
  releases: { en: 'releases', zh: '个版本' },
};

// ---------------------------------------------------------------- parsing

// "14.3-riscv64.conf" -> { release: "14.3", arch: "riscv64" }
// "26.1-xfce.conf"    -> { release: "26.1-xfce", arch: "x86_64" }
// "r151058-build.conf", "default.release.conf", "test.releases" -> null
function parseConfName(filename) {
  if (!filename.endsWith('.conf')) return null;
  if (filename === 'default.release.conf') return null;

  let base = filename.slice(0, -'.conf'.length);
  if (base.endsWith('-build')) return null;

  for (const arch of ARCHES) {
    if (base.endsWith('-' + arch)) {
      return { release: base.slice(0, -(arch.length + 1)), arch };
    }
  }
  return { release: base, arch: 'x86_64' };
}

// Parse the flat KEY=value format of datafile.ini. Values may be quoted, and
// a leading "@" means "the content lives elsewhere" -- we keep the raw string
// and let callers decide, because for RELEASE_TABLE the pointer itself is
// what we want.
function parseIni(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(trimmed);
    if (!m) continue;
    let value = m[2].trim();
    if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

function readFirstMatch(file, re) {
  if (!fs.existsSync(file)) return '';
  const m = re.exec(fs.readFileSync(file, 'utf8'));
  return m ? m[1] : '';
}

function collect(root) {
  const dirs = fs.readdirSync(root)
    .filter(name => name.endsWith('-vm'))
    .filter(name => name !== 'base-vm')          // the template, not an action
    .filter(name => fs.existsSync(path.join(root, name, 'conf')));

  const systems = dirs.map(dir => {
    const repo = path.join(root, dir);
    const ini = parseIni(path.join(repo, '.github', 'data', 'datafile.ini'));

    const releases = new Map();                  // release -> Set(arch)
    for (const file of fs.readdirSync(path.join(repo, 'conf'))) {
      const parsed = parseConfName(file);
      if (!parsed) continue;
      if (!releases.has(parsed.release)) releases.set(parsed.release, new Set());
      releases.get(parsed.release).add(parsed.arch);
    }

    const arches = new Set();
    for (const set of releases.values()) for (const a of set) arches.add(a);

    const syncPath = path.join(repo, '.github', 'data', 'sync-map.json');
    const syncMap = fs.existsSync(syncPath)
      ? JSON.parse(fs.readFileSync(syncPath, 'utf8'))
      : {};

    // "RELEASE_TABLE=@https://raw.githubusercontent.com/anyvm-org/freebsd-builder/..."
    // Note the host is raw.githubusercontent.com, not github.com.
    const builder = /githubusercontent\.com\/([^/]+\/[^/]+)\//.exec(ini.RELEASE_TABLE || '');

    return {
      dir,
      name: DISPLAY_NAME[dir] || ini.VM_NAME || dir,
      os: ini.VM_OS_NAME || dir.replace(/-vm$/, ''),
      icon: ini.VM_BRAND_ICON || '',
      // A repo that has never been released still carries @v0 in its
      // generated README (the version file starts at v0.0.0). v1 is the tag
      // every action ships under, so v0 reads as "not released yet", not as
      // a version anyone should type -- show v1 for it, same as when the
      // README carries no usage line at all.
      version: (function () {
        const v = readFirstMatch(path.join(repo, 'README.md'),
          new RegExp('uses: vmactions/' + dir + '@(v\\d+)'));
        return (!v || v === 'v0') ? 'v1' : v;
      })(),
      defaultRelease: readFirstMatch(
        path.join(repo, 'conf', 'default.release.conf'), /DEFAULT_RELEASE=(.*)/).trim(),
      releaseCount: releases.size,
      arches: COLUMNS.filter(a => arches.has(a)),
      syncByArch: Object.fromEntries(
        COLUMNS.filter(a => arches.has(a)).map(a => [a, syncMap[a] || []])),
      shell: ini.VM_SHELL_COMMENTS || '',
      prepare: (ini.VM_PREPARE || '').startsWith('@') ? '' : (ini.VM_PREPARE || ''),
      builder: builder ? builder[1] : '',
    };
  });

  systems.sort((a, b) => {
    const ia = ORDER.indexOf(a.dir), ib = ORDER.indexOf(b.dir);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.dir.localeCompare(b.dir);
  });

  return systems;
}

// ---------------------------------------------------------------- rendering

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Both languages, every time. A node with only one half vanishes when the
// reader switches -- it does not fall back.
//
// One element carrying two spans, never two elements. Emitting <th> twice put
// nine header cells above eight columns, which looks right but tells a screen
// reader the table is ragged; the same trap applies to <dt> in a grid row.
function bi(tag, key, attrs) {
  const a = attrs ? ' ' + attrs : '';
  return `<${tag}${a}>` +
    `<span lang="en">${esc(T[key].en)}</span>` +
    `<span lang="zh">${esc(T[key].zh)}</span>` +
    `</${tag}>`;
}

function usedColumns(systems) {
  return COLUMNS.filter(col => systems.some(s => s.arches.includes(col)));
}

function renderCounts(systems) {
  const columns = usedColumns(systems);
  const combos = systems.reduce((n, s) => n + s.arches.length, 0);
  const stat = (value, key) =>
    `    <div class="stat">\n` +
    `      <span class="stat-n">${value}</span>\n` +
    `      ${bi('span', key, 'class="stat-l"')}\n` +
    `    </div>`;
  return [
    stat(systems.length, 'systems'),
    stat(columns.length, 'architectures'),
    stat(combos, 'combinations'),
  ].join('\n');
}

function renderMatrix(systems) {
  const columns = usedColumns(systems);
  const lines = [];

  lines.push('  <div class="scroll-x">');
  lines.push('    <table class="matrix">');
  lines.push('      <thead>');
  lines.push('        <tr>');
  lines.push('          ' + bi('th', 'system', 'scope="col"'));
  for (const col of columns) {
    lines.push(`          <th scope="col"><code>${esc(col)}</code></th>`);
  }
  lines.push('        </tr>');
  lines.push('      </thead>');
  lines.push('      <tbody>');

  for (const s of systems) {
    // The repo's Marketplace icon, coloured like the row stripe. A repo whose
    // datafile names no icon (or one we have no shape for) keeps the dot.
    const mark = FEATHER[s.icon]
      ? '<svg class="os-icon" viewBox="0 0 24 24" fill="none"' +
        ' stroke="currentColor" stroke-width="2" stroke-linecap="round"' +
        ` stroke-linejoin="round" aria-hidden="true">${FEATHER[s.icon]}</svg>`
      : '<span class="dot"></span>';
    lines.push(`        <tr data-os="${esc(s.os)}">`);
    // Name the architectures in the row header when the system has no
    // x86_64 build. The matrix is eleven columns wide and scrolls sideways,
    // so a guest whose only column is i386 or armv7 reads as a completely
    // empty row until the reader scrolls -- which looks like "not supported
    // at all" rather than "supported, further right".
    const archHint = s.arches.includes('x86_64')
      ? ''
      : ` <span class="row-arch">${esc(s.arches.join(' '))}</span>`;
    lines.push(`          <th scope="row">${mark}${esc(s.name)}${archHint}</th>`);
    for (const col of columns) {
      if (!s.arches.includes(col)) {
        lines.push('          <td class="no"><span aria-hidden="true">&middot;</span></td>');
        continue;
      }
      const methods = s.syncByArch[col] || [];
      const cell = methods.length
        ? methods.map(m => `<code>${esc(m)}</code>`).join(' ')
        : '<span class="warn">--</span>';
      lines.push(`          <td class="yes">${cell}</td>`);
    }
    lines.push('        </tr>');
  }

  lines.push('      </tbody>');
  lines.push('    </table>');
  lines.push('  </div>');
  lines.push('  ' + bi('p', 'matrixNote', 'class="note"'));
  return lines.join('\n');
}

// The hero's simulated run. Decorative -- the markup is aria-hidden -- but it
// is generated all the same, so it can never advertise a system that is not
// actually shipped.
function renderRun(systems) {
  // Rendered in the passed state. site.js adds .pending and then clears it row
  // by row -- so with JavaScript off the reader sees a complete list rather
  // than a column of greyed-out rows that never resolve.
  return systems.map(s => [
    `      <li data-os="${esc(s.os)}">`,
    `        <span class="tick">&#10003;</span>`,
    `        <code>vmactions/${esc(s.dir)}@${esc(s.version)}</code>`,
    '      </li>',
  ].join('\n')).join('\n');
}

function renderCards(systems) {
  return systems.map(s => {
    const uses = `vmactions/${s.dir}@${s.version}`;
    const rows = [];

    rows.push(`      <div class="row">${bi('dt', 'defaultRelease')}` +
      `<dd><code>${esc(s.defaultRelease)}</code> ` +
      `<span class="dim">(${s.releaseCount} ` +
      `<span lang="en">${esc(T.releases.en)}</span>` +
      `<span lang="zh">${esc(T.releases.zh)}</span>)</span></dd></div>`);

    rows.push(`      <div class="row">${bi('dt', 'arches')}<dd>` +
      s.arches.map(a => `<code>${esc(a)}</code>`).join(' ') + '</dd></div>');

    rows.push(`      <div class="row">${bi('dt', 'sync')}<dd>` +
      s.arches.map(a => {
        const methods = (s.syncByArch[a] || []).join(', ') || '--';
        return `<span class="sync"><code>${esc(a)}</code> ${esc(methods)}</span>`;
      }).join('') + '</dd></div>');

    if (s.shell) {
      rows.push(`      <div class="row">${bi('dt', 'shell')}` +
        `<dd>${inlineCode(s.shell)}</dd></div>`);
    }
    if (s.prepare) {
      rows.push(`      <div class="row">${bi('dt', 'prepare')}` +
        `<dd><code>${esc(s.prepare)}</code></dd></div>`);
    }

    const links = [
      `<a href="https://github.com/vmactions/${esc(s.dir)}">` +
      `<span lang="en">${esc(T.repo.en)}</span><span lang="zh">${esc(T.repo.zh)}</span></a>`,
    ];
    if (s.builder) {
      links.push(`<a href="https://github.com/${esc(s.builder)}">` +
        `<span lang="en">${esc(T.builder.en)}</span>` +
        `<span lang="zh">${esc(T.builder.zh)}</span></a>`);
    }

    return [
      `    <article class="card" data-os="${esc(s.os)}">`,
      `      <h3><span class="dot"></span>${esc(s.name)}</h3>`,
      `      <p class="uses"><code>${esc(uses)}</code></p>`,
      '      <dl>',
      rows.join('\n'),
      '      </dl>',
      `      <p class="links">${links.join('')}</p>`,
      '    </article>',
    ].join('\n');
  }).join('\n');
}

// VM_SHELL_COMMENTS is authored with markdown backticks; keep them as code.
function inlineCode(text) {
  return esc(text).replace(/`([^`]+)`/g, '<code>$1</code>');
}

// ---------------------------------------------------------------- injection

function inject(source, marker, content) {
  const begin = `<!-- BEGIN generated:${marker} -->`;
  const end = `<!-- END generated:${marker} -->`;
  const from = source.indexOf(begin);
  const to = source.indexOf(end);
  if (from === -1 || to === -1) {
    throw new Error(`marker "${marker}" not found -- expected ${begin} ... ${end}`);
  }
  if (to < from) {
    throw new Error(`marker "${marker}" is inverted: END appears before BEGIN`);
  }
  return source.slice(0, from + begin.length) + '\n' + content + '\n' +
    source.slice(to);
}

function writeIfChanged(file, content) {
  const existing = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (existing === content) return false;
  fs.writeFileSync(file, content);
  return true;
}

// ---------------------------------------------------------------- main

function main() {
  const systems = collect(SIBLINGS);
  const columns = usedColumns(systems);
  const combos = systems.reduce((n, s) => n + s.arches.length, 0);

  if (process.argv.includes('--print')) {
    for (const s of systems) {
      console.log('%s  %s  default=%s  %s',
        s.dir.padEnd(18), s.name.padEnd(15),
        s.defaultRelease.padEnd(14), s.arches.join(', '));
    }
    console.log('\n%d systems, %d architectures, %d combinations',
      systems.length, columns.length, combos);
    return;
  }

  const root = path.resolve(__dirname, '..');

  // The hero animation is the only consumer, and it is decorative.
  const data = 'window.VMACTIONS_DATA = ' + JSON.stringify({
    systems: systems.map(s => ({
      name: s.name, os: s.os, dir: s.dir, arches: s.arches,
    })),
    counts: { systems: systems.length, arches: columns.length, combos },
  }, null, 2) + ';\n';
  const dataChanged = writeIfChanged(path.join(root, 'assets', 'data.js'),
    '// Generated by tools/build-data.js -- do not edit.\n' + data);

  const indexPath = path.join(root, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  html = inject(html, 'run', renderRun(systems));
  html = inject(html, 'counts', renderCounts(systems));
  html = inject(html, 'matrix', renderMatrix(systems));
  html = inject(html, 'cards', renderCards(systems));
  const htmlChanged = writeIfChanged(indexPath, html);

  console.log('%d systems, %d architectures, %d combinations',
    systems.length, columns.length, combos);
  console.log('assets/data.js %s', dataChanged ? 'updated' : 'unchanged');
  console.log('index.html     %s', htmlChanged ? 'updated' : 'unchanged');
}

if (require.main === module) main();

module.exports = {
  ARCHES, COLUMNS, parseConfName, parseIni, collect,
  renderRun, renderCounts, renderMatrix, renderCards, inject,
};
