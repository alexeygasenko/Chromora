import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const requestedOutput = process.argv[2];
const tempRoot = path.resolve(os.tmpdir());
const output = requestedOutput ? path.resolve(requestedOutput) : fs.mkdtempSync(path.join(tempRoot, 'chromora-docs-'));
try {
  const result = spawnSync(process.execPath, ['node_modules/jsdoc/jsdoc.js', '-c', 'jsdoc.json', '-d', output], {stdio: 'inherit'});
  if (result.error) {throw result.error;}
  if (result.status) {process.exitCode = result.status;}
  else if (!fs.existsSync(path.join(output, 'index.html'))) {throw new Error('JSDoc did not produce index.html');}
} finally {
  if (!requestedOutput && path.dirname(path.resolve(output)) === tempRoot && path.basename(output).startsWith('chromora-docs-')) {
    fs.rmSync(output, {recursive: true, force: true});
  }
}
