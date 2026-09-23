import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {parse} from 'acorn';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const cleanDir = process.argv[2];
assert.ok(cleanDir, 'Pass the audit clean-build dist directory');

function inspect(label, code) {
  const ast = parse(code, {ecmaVersion: 'latest'});
  let colorGetter;
  let geometryGetter;
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionExpression') {
      const text = code.slice(node.start, node.end);
      const colorMatch = text.match(/return"horizontal"==\w+\?\.([\w$]+)\?"horizontal":"vertical"/);
      if (colorMatch && text.length < 250) colorGetter = {property: colorMatch[1], text};
      const geometryMatch = text.match(/\w+\.([\w$]+)\?\?\(\w+\.\1=\{\}\)/);
      if (geometryMatch && text.includes('[t]') && text.endsWith(':null}') && text.length < 300) geometryGetter = {property: geometryMatch[1], text};
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(ast);
  return {label, colorGetter, geometryGetter};
}

const builds = [
  inspect('working-dist', fs.readFileSync(path.join(repo, 'dist/Chromora.user.js'), 'utf8')),
  inspect('clean-local', fs.readFileSync(path.join(cleanDir, 'Chromora.local.user.js'), 'utf8')),
  inspect('clean-ci', fs.readFileSync(path.join(cleanDir, 'Chromora.user.js'), 'utf8'))
];
for (const ref of ['c92cce4', '7229c7a', '99a85e7', '4d02a73', '8d3c9a1']) {
  const file = spawnSync('git', ['show', `${ref}:dist/Chromora.user.js`], {cwd: repo, encoding: 'utf8', maxBuffer: 2 * 1024 * 1024});
  if (file.status === 0) builds.push(inspect(`git:${ref}`, file.stdout));
}

function evaluateGetter(getter, state, argument) {
  // Execute the exact minified getter, while replacing only its private-state accessor.
  const accessor = getter.text.match(/const \w+=(\w+)\(this,(\w+),(\w+)\)\.call\(this\)/);
  assert.ok(accessor, getter.text);
  const context = {state};
  context[accessor[1]] = () => () => state;
  context[accessor[2]] = {};
  context[accessor[3]] = {};
  context.argument = argument;
  return vm.runInNewContext(`(${getter.text})(argument)`, context);
}

const transitions = [];
for (const oldBuild of builds.filter(build => build.colorGetter)) {
  const nextBuild = builds.find(build => build.label === 'clean-ci');
  const persisted = {
    [oldBuild.colorGetter.property]: 'horizontal',
    [oldBuild.geometryGetter.property]: {horizontal: {width: 740, height: 260, x: 44, y: 55}}
  };
  const oldRead = evaluateGetter(oldBuild.colorGetter, persisted);
  const newRead = evaluateGetter(nextBuild.colorGetter, persisted);
  const oldGeometry = evaluateGetter(oldBuild.geometryGetter, persisted, 'horizontal');
  const newGeometry = evaluateGetter(nextBuild.geometryGetter, persisted, 'horizontal');
  assert.equal(oldRead, 'horizontal');
  assert.equal(newGeometry.width, 740);
  assert.equal(newGeometry.x, 44);
  transitions.push({from: oldBuild.label, to: nextBuild.label, persisted, oldRead, newRead, oldGeometry, newGeometry});
}

const output = {generatedAt: new Date().toISOString(), builds, transitions};
fs.writeFileSync(path.join(repo, 'audit/2026-09-23/build-security/storage-mangling-results.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify(output, null, 2));
