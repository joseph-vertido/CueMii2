#!/usr/bin/env node
/**
 * Copies the DigitalPersona browser scripts from node_modules into public/websdk/
 * so index.html can load them. Run after installing:
 *   @digitalpersona/websdk  and  @digitalpersona/fingerprint
 *
 * Invoked by `npm run setup:fingerprint`.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEST = path.join(ROOT, 'public', 'websdk');

const FILES = [
  {
    from: path.join(ROOT, 'node_modules', '@digitalpersona', 'websdk', 'dist', 'websdk.client.ui.min.js'),
    to: path.join(DEST, 'websdk.client.ui.min.js'),
  },
  {
    from: path.join(ROOT, 'node_modules', '@digitalpersona', 'fingerprint', 'dist', 'fingerprint.sdk.min.js'),
    to: path.join(DEST, 'fingerprint.sdk.min.js'),
  },
];

fs.mkdirSync(DEST, { recursive: true });

let ok = 0;
for (const f of FILES) {
  if (!fs.existsSync(f.from)) {
    console.warn('  [!] Missing: ' + path.relative(ROOT, f.from));
    console.warn('      Did you install @digitalpersona/websdk and @digitalpersona/fingerprint?');
    continue;
  }
  fs.copyFileSync(f.from, f.to);
  console.log('  [OK] ' + path.relative(ROOT, f.to));
  ok++;
}

if (ok === FILES.length) {
  console.log('\n  Fingerprint scripts staged into public/websdk/.');
} else {
  process.exitCode = 1;
}
