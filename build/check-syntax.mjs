import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

function checkDirectory(directory) {
  for (const entry of fs.readdirSync(directory, {withFileTypes: true})) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {checkDirectory(file);}
    else if (/\.m?js$/.test(entry.name)) {
      const result = spawnSync(process.execPath, ['--check', file], {stdio: 'inherit'});
      if (result.error) {throw result.error;}
      if (result.status) {process.exitCode = 1;}
    }
  }
}
for (const directory of ['src', 'build', 'tests']) {checkDirectory(directory);}
