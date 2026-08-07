// Tests for the conf-name parser. Run with: node tools/build-data.test.js
//
// The parser is the one place in this repo where a silent mistake changes what
// the site claims to support: "26.1-xfce.conf" is a GhostBSD desktop flavor,
// not an architecture, and reading it as one would invent an "xfce" column.

const assert = require('assert');
const { parseConfName, ARCHES } = require('./build-data.js');

// A plain release conf means the implicit x86_64 build.
assert.deepStrictEqual(parseConfName('14.3.conf'),
  { release: '14.3', arch: 'x86_64' });
assert.deepStrictEqual(parseConfName('r151058.conf'),
  { release: 'r151058', arch: 'x86_64' });
assert.deepStrictEqual(parseConfName('0m40.conf'),
  { release: '0m40', arch: 'x86_64' });

// An arch suffix is only an arch when it is in the whitelist.
assert.deepStrictEqual(parseConfName('14.3-riscv64.conf'),
  { release: '14.3', arch: 'riscv64' });
assert.deepStrictEqual(parseConfName('13.2-powerpc64.conf'),
  { release: '13.2', arch: 'powerpc64' });
assert.deepStrictEqual(parseConfName('11.0-sparc64.conf'),
  { release: '11.0', arch: 'sparc64' });
assert.deepStrictEqual(parseConfName('2025-i386.conf'),
  { release: '2025', arch: 'i386' });

// Releases whose own name contains dashes must survive intact.
assert.deepStrictEqual(parseConfName('24.03-LTS-SP4.conf'),
  { release: '24.03-LTS-SP4', arch: 'x86_64' });
assert.deepStrictEqual(parseConfName('24.03-LTS-SP4-loongarch64.conf'),
  { release: '24.03-LTS-SP4', arch: 'loongarch64' });
assert.deepStrictEqual(parseConfName('22.03-LTS-SP4-aarch64.conf'),
  { release: '22.03-LTS-SP4', arch: 'aarch64' });

// Flavors are part of the release name, never an architecture.
assert.deepStrictEqual(parseConfName('26.1-xfce.conf'),
  { release: '26.1-xfce', arch: 'x86_64' });
assert.deepStrictEqual(parseConfName('26.1-gershwin.conf'),
  { release: '26.1-gershwin', arch: 'x86_64' });
assert.deepStrictEqual(parseConfName('11.4-gcc-14.conf'),
  { release: '11.4-gcc-14', arch: 'x86_64' });
assert.deepStrictEqual(parseConfName('11.4-clang-19.conf'),
  { release: '11.4-clang-19', arch: 'x86_64' });

// Build-only variants and non-release files are skipped entirely.
assert.strictEqual(parseConfName('r151058-build.conf'), null);
assert.strictEqual(parseConfName('202604-build.conf'), null);
assert.strictEqual(parseConfName('default.release.conf'), null);
assert.strictEqual(parseConfName('test.releases'), null);
assert.strictEqual(parseConfName('README.md'), null);

// The whitelist itself is part of the contract: adding an arch to the site
// means adding it here, and x86_64 is implicit rather than a suffix.
assert.ok(!ARCHES.includes('x86_64'),
  'x86_64 is implicit and must not be in the suffix whitelist');
assert.deepStrictEqual(ARCHES,
  ['aarch64', 'riscv64', 'powerpc64', 'sparc64', 'i386', 'loongarch64']);

console.log('parseConfName: all assertions passed');
