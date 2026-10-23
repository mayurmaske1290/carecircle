import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('CLI shows usage and exits with code 2 without endpoint', async () => {
  const child = spawn(process.execPath, ['index.mjs'], { cwd: new URL('.', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', d => stderr += d.toString());
  const code = await new Promise(resolve => child.on('close', resolve));
  assert.equal(code, 2);
  assert.match(stderr, /Usage:/);
});
