import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const outputDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(outputDir, '../../..');
const site = path.join(root, 'website');
const html = fs.readFileSync(path.join(site, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(site, 'styles.css'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const localReferences = [...html.matchAll(/\b(?:src|href)="(\.[^"]+)"/g), ...css.matchAll(/url\("(\.[^"]+)"\)/g)].map(match => match[1]);
const ariaReferences = [...html.matchAll(/\b(?:aria-controls|aria-labelledby|aria-describedby)="([^"]+)"/g)].flatMap(match => match[1].split(/\s+/));
const anchorReferences = [...html.matchAll(/\bhref="#([^"]+)"/g)].map(match => match[1]);
const result = {
  localReferencesChecked: [...new Set(localReferences)],
  missingLocalFiles: localReferences.filter(reference => !fs.existsSync(path.resolve(site, reference))),
  duplicateIDs: ids.filter((id, index) => ids.indexOf(id) !== index),
  missingAriaReferenceIDs: ariaReferences.filter(id => !ids.includes(id)),
  missingAnchorIDs: anchorReferences.filter(id => !ids.includes(id)),
  hasHTMLLanguage: /<html[^>]+\blang="[^"]+"/.test(html),
  imageTagsWithoutAlt: [...html.matchAll(/<img\b[^>]*>/g)].map(match => match[0]).filter(tag => !/\balt=/.test(tag)),
  scope: 'Static local path/reference checks only; no external URL checks, browser rendering, screen-reader or WCAG certification.',
};
fs.writeFileSync(path.join(outputDir, 'website-check-results.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
