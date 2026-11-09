#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HQStore } from '../server/store.mjs';

const store = new HQStore(process.env.HQ_DB_PATH || resolve('data/hq.sqlite'));
try {
  const [action, inputPath] = process.argv.slice(2);
  if (action === 'state') console.log(JSON.stringify(store.state(), null, 2));
  else if (action === 'operations') console.log(JSON.stringify(store.operations.state(), null, 2));
  else if (action === 'command' && inputPath) {
    const content = readFileSync(inputPath === '-' ? 0 : inputPath, 'utf8');
    if (Buffer.byteLength(content) > 1000000) throw new Error('Command exceeds 1 MB limit');
    const command = JSON.parse(content);
    // The CLI is a trusted local operator channel, not a remote actor-authentication service.
    console.log(JSON.stringify(store.command(command), null, 2));
  } else throw new Error('Usage: node scripts/hq.mjs state | operations | command <JSON-file-or-dash>');
} catch (error) { console.error(JSON.stringify({ error: error.code || 'invalid_input', message: error.message })); process.exitCode = 1; }
finally { store.close(); }
