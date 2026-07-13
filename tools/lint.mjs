// Dependency-free lint: syntax-check every inline <script> and assert the HTML skeleton.
// No app dependency — uses only Node built-ins (ADR-001 intact).
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync('src/index.html', 'utf8');

let scripts = 0;
for (const block of html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || []) {
  const code = block.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '');
  if (!code.trim()) continue;
  try {
    new vm.Script(code); // syntax check only — does not execute
    scripts++;
  } catch (e) {
    console.error(`✗ JS syntax error in <script>: ${e.message}`);
    process.exit(1);
  }
}

for (const tag of ['html', 'head', 'body']) {
  if (!new RegExp(`<${tag}[\\s>]`, 'i').test(html)) {
    console.error(`✗ missing <${tag}>`);
    process.exit(1);
  }
}

console.log(`✓ lint OK — ${scripts} script block(s) parsed, HTML skeleton present`);
