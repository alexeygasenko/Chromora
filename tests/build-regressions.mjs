import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import test from 'node:test';
import {minify} from 'terser';
import mangleSelectors from '../build/cssMangler.js';

const buildSource = fs.readFileSync(new URL('../build/build.js', import.meta.url), 'utf8');
const workflow = fs.readFileSync(new URL('../.github/workflows/build.yml', import.meta.url), 'utf8');

function temporaryDirectory(callback) {
  const root = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(root, 'chromora-build-test-'));
  try {return callback(directory);}
  finally {
    if (path.dirname(path.resolve(directory)) === root && path.basename(directory).startsWith('chromora-build-test-')) {
      fs.rmSync(directory, {recursive: true, force: true});
    }
  }
}

test('the production minifier preserves stored settings and page/worker property contracts', async () => {
  const match = buildSource.match(/let resultTerser = await terser\.minify\(resultEsbuildJS\.text, (\{[\s\S]*?)\n\}\);/);
  assert.ok(match, 'Locate the actual release minifier configuration');
  const configuration = vm.runInNewContext(`(${match[1]}\n})`, {isGitHub: true});
  const settings = {windowMain: {x: 10, y: 20, isOpen: true, collapsed: true},
    windowTemplates: {x: 30, y: 40, isOpen: false, collapsed: false},
    windowSettings: {x: 50, y: 60, isOpen: true, collapsed: false},
    windowFilter: {x: 44, y: 55, colorLayout: 'horizontal', layoutSizes: {horizontal: {x: 44, y: 55, width: 740, height: 260}},
      isOpen: true, collapsed: true, sortPrimary: 'percent', sortSecondary: 'descending', showUnused: false},
    hotkeys: {paintArea: 'AltLeft', paintAllArea: 'ControlLeft'}, flags: ['ftr-oWin'], filter: [2, 4]};
  const contract = {source: 'blue-marble', blobID: '123', revision: 5, requestSequence: 7, automatedClicks: [], hotkeys: {}, paintArea: true};
  // Use unquoted object keys, exactly the form that used to rename persisted fields.
  const source = `globalThis.saved = JSON.stringify(${JSON.stringify(settings).replace(/"([A-Za-z]+)":/g, '$1:')});
    globalThis.message = ${JSON.stringify(contract).replace(/"([A-Za-z]+)":/g, '$1:')};`;
  const output = await minify(source, configuration);
  const context = {};
  vm.runInNewContext(output.code, context);
  assert.deepEqual(JSON.parse(context.saved), settings);
  assert.deepEqual(JSON.parse(JSON.stringify(context.message)), contract);
});

test('CSS mapping only changes whole class/id names and keeps protocol/storage/variables intact', () => temporaryDirectory(directory => {
  const pathJS = path.join(directory, 'test.js');
  const pathCSS = path.join(directory, 'test.css');
  fs.writeFileSync(pathJS, `const a = 'bm-card'; const b = 'bm-card-title'; const unrelated = 'bm-last-me bm-revision bm-name bm-card-extra --bm-card';`);
  fs.writeFileSync(pathCSS, `.bm-card{--bm-card:1;color:red}#bm-card-title{color:blue}`);
  const mapping = mangleSelectors({inputPrefix: 'bm-', outputPrefix: 'bm-', pathJS, pathCSS, returnMap: true,
    importMap: {'bm-last-me': 'bm-0', 'bm-card': 'bm-1'}});
  assert.deepEqual(Object.keys(mapping).sort(), ['bm-card', 'bm-card-title']);
  assert.equal(new Set(Object.values(mapping)).size, 2);
  const script = fs.readFileSync(pathJS, 'utf8');
  assert.ok(script.includes(`'${mapping['bm-card']}'`));
  assert.ok(script.includes(`'${mapping['bm-card-title']}'`));
  assert.ok(script.includes('bm-last-me bm-revision bm-name bm-card-extra --bm-card'));
  assert.ok(fs.readFileSync(pathCSS, 'utf8').includes('--bm-card:1'));
}));

test('literal hostile commit messages remain data through the actual publication commands', () => temporaryDirectory(directory => {
  const start = workflow.indexOf("          printf 'Build userscript from");
  const end = workflow.indexOf('\n            # Publish both refs', start);
  assert.ok(start >= 0 && end > start);
  const commands = workflow.slice(start, end).replace(/^\s{10,12}/gm, '');
  assert.equal(commands.includes('${{'), false);
  const malicious = 'Fix $(printf INJECTION_EXECUTED >&2) `printf BACKTICK_EXECUTED >&2`\nEOF\n\"quote\"';
  const bash = process.platform === 'win32' ? 'C:/Program Files/Git/bin/bash.exe' : 'bash';
  const result = spawnSync(bash, ['--noprofile', '--norc', '-s'], {encoding: 'utf8',
    env: {...process.env, RUNNER_TEMP: directory.replace(/\\/g, '/'), SOURCE_SHA: '1'.repeat(40), TEST_COMMIT_MESSAGE: malicious},
    input: `set -eu\ngit() { if [ "$1" = log ]; then printf '%s\\n' "$TEST_COMMIT_MESSAGE"; elif [ "$1" = commit ]; then cat "$3"; fi; }\n${commands}\n`});
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.stdout.includes(malicious));
  assert.equal(result.stderr, '');
}));

test('CI validates PRs with read-only credentials and publishes only matching source artifacts', () => {
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /run: npm ci/);
  assert.match(workflow, /run: npm test/);
  assert.match(workflow, /run: npm run test:bundle/);
  assert.match(workflow, /needs: validate/);
  assert.match(workflow, /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
  assert.equal((workflow.match(/name: userscript-\$\{\{ github.sha \}\}/g) || []).length, 2);
  assert.match(workflow, /git rev-parse origin\/main\)" != "\$SOURCE_SHA"/);
  assert.match(workflow, /sha256sum --check build-checksums\.txt/);
  assert.match(workflow, /git push --atomic/);
  assert.match(workflow, /--force-with-lease="refs\/heads\/main:\$SOURCE_SHA"/);
  assert.match(workflow, /--force-with-lease="refs\/heads\/wiki:\$wiki_sha"/);
  assert.doesNotMatch(workflow, /npm install|git reset --hard|git push --force origin|git merge --squash/);
});

test('atomic publication updates both refs and rejects a main change after the freshness check', () => {
  for (const simulateRace of [false, true]) temporaryDirectory(directory => {
    const remote = path.join(directory, 'origin.git');
    const working = path.join(directory, 'working');
    const git = (args, cwd = working, expectSuccess = true) => {
      const result = spawnSync('git', args, {cwd, encoding: 'utf8'});
      if (expectSuccess) assert.equal(result.status, 0, `${args.join(' ')}\n${result.stderr}`);
      return result;
    };
    git(['init', '--bare', remote], directory);
    git(['init', '-b', 'main', working], directory);
    git(['config', 'user.name', 'Publication test']);
    git(['config', 'user.email', 'publication-test@example.invalid']);
    git(['remote', 'add', 'origin', remote]);
    fs.writeFileSync(path.join(working, 'source.txt'), 'base');
    git(['add', 'source.txt']);
    git(['commit', '-m', 'Source']);
    const source = git(['rev-parse', 'HEAD']).stdout.trim();
    git(['push', 'origin', 'HEAD:main', 'HEAD:wiki']);
    fs.writeFileSync(path.join(working, 'bundle.txt'), 'validated artifact');
    git(['add', 'bundle.txt']);
    git(['commit', '-m', 'Build']);
    const built = git(['rev-parse', 'HEAD']).stdout.trim();
    fs.writeFileSync(path.join(working, 'api-docs.txt'), 'validated docs');
    git(['add', 'api-docs.txt']);
    git(['commit', '-m', 'Docs']);
    const docs = git(['rev-parse', 'HEAD']).stdout.trim();
    let concurrent;
    if (simulateRace) {
      git(['switch', '-c', 'concurrent', source]);
      fs.writeFileSync(path.join(working, 'source.txt'), 'newer source');
      git(['add', 'source.txt']);
      git(['commit', '-m', 'Concurrent change']);
      concurrent = git(['rev-parse', 'HEAD']).stdout.trim();
      git(['push', 'origin', 'HEAD:main']);
      git(['checkout', '--detach', docs]);
    }
    const result = git(['push', '--atomic', `--force-with-lease=refs/heads/main:${source}`,
      `--force-with-lease=refs/heads/wiki:${source}`, 'origin', `${built}:refs/heads/main`, 'HEAD:refs/heads/wiki'], working, false);
    assert.equal(result.status === 0, !simulateRace, result.stderr);
    assert.equal(git(['rev-parse', 'refs/heads/main'], remote).stdout.trim(), simulateRace ? concurrent : built);
    assert.equal(git(['rev-parse', 'refs/heads/wiki'], remote).stdout.trim(), simulateRace ? source : docs);
  });
});
