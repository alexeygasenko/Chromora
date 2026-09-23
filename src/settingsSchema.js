/** Stable, validated persisted settings, shared with the renderer. */
export const DEFAULT_HIGHLIGHT = Object.freeze([Object.freeze([2, 0, 0])]);
export const INTERFACE_THEMES = Object.freeze([
  {id: 'glass', label: 'Glass', description: 'Transparent & blurred'},
  {id: 'light', label: 'Light', description: 'Solid light surfaces'},
  {id: 'dark', label: 'Dark', description: 'Solid dark surfaces'},
  {id: 'aero', label: 'Frutiger Aero', description: 'Sky, glass & fresh green'}
]);

const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
export function normalizeHighlight(value) {
  if (!Array.isArray(value) || value.some(entry => !Array.isArray(entry) || entry.length !== 3
    || !entry.every(Number.isInteger) || entry[0] < 0 || entry[0] > 2
    || Math.abs(entry[1]) > 1 || Math.abs(entry[2]) > 1)) {
    return DEFAULT_HIGHLIGHT.map(entry => [...entry]);
  }
  const cells = new Map();
  for (const [state, x, y] of value) {cells.set(`${x},${y}`, [state, x, y]);}
  return [...cells.values()].filter(([state]) => state !== 0);
}

export function normalizeUserSettings(value) {
  const settings = isRecord(value) ? structuredClone(value) : {};
  settings.flags = Array.isArray(settings.flags)
    ? [...new Set(settings.flags.filter(flag => typeof flag === 'string' && flag.length <= 100))] : [];
  settings.highlight = normalizeHighlight(settings.highlight);
  settings.filter = Array.isArray(settings.filter)
    ? [...new Set(settings.filter.filter(id => Number.isInteger(id) && id >= -2 && id <= 255))] : [];
  settings.hotkeys = isRecord(settings.hotkeys) ? settings.hotkeys : {};
  for (const [key, fallback] of [['paintArea', 'AltLeft'], ['paintAllArea', 'ControlLeft']]) {
    const code = settings.hotkeys[key];
    settings.hotkeys[key] = typeof code === 'string' && /^[A-Za-z][A-Za-z0-9]{1,31}$/.test(code) ? code : fallback;
  }
  if (settings.hotkeys.paintArea === settings.hotkeys.paintAllArea) {
    settings.hotkeys.paintAllArea = settings.hotkeys.paintArea === 'ControlLeft' ? 'AltLeft' : 'ControlLeft';
  }
  delete settings.hotkeys.clearPaintArea;
  for (const key of ['windowFilter', 'windowSettings', 'windowTemplates']) {
    settings[key] = isRecord(settings[key]) ? settings[key] : {};
  }
  // Versions 1.1–1.3 persisted two Terser-mangled keys. Migrate only this record.
  const filterWindow = settings.windowFilter;
  filterWindow.colorLayout ??= filterWindow.xi;
  filterWindow.layoutSizes ??= filterWindow.Ci;
  delete filterWindow.xi;
  delete filterWindow.Ci;
  filterWindow.colorLayout = filterWindow.colorLayout === 'horizontal' ? 'horizontal' : 'vertical';
  filterWindow.layoutSizes = isRecord(filterWindow.layoutSizes) ? filterWindow.layoutSizes : {};
  for (const layout of ['horizontal', 'vertical']) {
    if (!isRecord(filterWindow.layoutSizes[layout])) {delete filterWindow.layoutSizes[layout];}
  }
  const states = [settings.windowFilter, settings.windowSettings, settings.windowTemplates,
    ...['horizontal', 'vertical'].map(layout => filterWindow.layoutSizes[layout]).filter(isRecord)];
  for (const state of states) {
    for (const key of ['x', 'y', 'width', 'height']) {
      if (state[key] != null && (!Number.isFinite(state[key]) || (['width', 'height'].includes(key) && state[key] <= 0))) {delete state[key];}
    }
  }
  return settings;
}
