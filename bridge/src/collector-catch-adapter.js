import { open, stat as fsStat } from 'node:fs/promises';

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_MAX_EVENTS = 50_000;
const VARIANTS = new Set(['normal', 'gigantic', 'albino', 'melanistic', 'trophy', 'fabled']);
const WEATHERS = new Set(['clear', 'rain', 'thunder']);
const DAY_PHASES = new Set(['dawn', 'day', 'dusk', 'night']);
const QUALITY_STATUSES = Object.freeze({
  weather: new Set(['observed', 'derived', 'unresolved', 'unavailable']),
  timeBand: new Set(['observed', 'derived', 'unresolved', 'unavailable']),
  bait: new Set(['observed', 'none', 'disabled', 'unavailable']),
  armor: new Set(['observed', 'unavailable'])
});
const ROOT_KEYS_V1 = new Set(['schemaVersion', 'eventId', 'caughtAt', 'sessionId', 'fish', 'context', 'setup', 'source']);
const ROOT_KEYS_V2 = new Set([...ROOT_KEYS_V1, 'quality']);
const FISH_KEYS = new Set(['displayName', 'normalizedId', 'rarity', 'variant', 'size', 'weightLb', 'lengthIn']);
const CONTEXT_KEYS_V1 = new Set(['locationName', 'subLocation', 'weather', 'timeBand', 'temperature']);
const CONTEXT_KEYS_V2 = new Set([...CONTEXT_KEYS_V1, 'weatherRaw', 'timeText']);
const SETUP_KEYS = new Set(['pole', 'reel', 'line', 'bait', 'armor', 'pet']);
const SOURCE_KEYS = new Set(['collectorVersion', 'minecraftVersion', 'extrasVersion', 'confidence']);
const QUALITY_KEYS = new Set(['weather', 'timeBand', 'bait', 'armor']);

async function defaultReadTail(filePath, maxBytes) {
  const handle = await open(filePath, 'r');
  try {
    const details = await handle.stat();
    const length = Math.min(details.size, maxBytes);
    if (length <= 0) return '';
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, details.size - length);
    let text = buffer.toString('utf8');
    if (details.size > length) text = text.slice(Math.max(0, text.indexOf('\n') + 1));
    return text;
  } finally {
    await handle.close();
  }
}

const exactKeys = (value, allowed) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).every(key => allowed.has(key));

function text(value, max = 120, { required = false } = {}) {
  if (value == null) return required ? undefined : null;
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if ((!cleaned && required) || cleaned.length > max) return undefined;
  return cleaned || null;
}

function measurement(value) {
  if (value == null) return null;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= 10_000_000 ? value : undefined;
}

function semanticWeather(value) {
  const raw = text(value, 40);
  if (raw == null) return { value: null, status: 'unavailable' };
  const normalized = raw.toLowerCase();
  if (['clear', 'sunny', 'sun'].includes(normalized) || raw === '☀') {
    return { value: 'clear', status: normalized === 'clear' ? 'observed' : 'derived' };
  }
  if (['rain', 'raining', 'rainy', 'shower', 'showers'].includes(normalized)) {
    return { value: 'rain', status: normalized === 'rain' ? 'observed' : 'derived' };
  }
  if (normalized.includes('thunder') || normalized.includes('storm') || normalized.includes('lightning')) {
    return { value: 'thunder', status: normalized === 'thunder' ? 'observed' : 'derived' };
  }
  return { value: null, status: 'unresolved' };
}

function semanticTime(value) {
  const raw = text(value, 40);
  if (raw == null) return { value: null, status: 'unavailable' };
  const normalized = raw.toLowerCase();
  if (DAY_PHASES.has(normalized)) return { value: normalized, status: 'observed' };
  const match = /^(\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(normalized);
  if (!match) return { value: null, status: 'unresolved' };
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour < 1 || hour > 12 || minute > 59) return { value: null, status: 'unresolved' };
  if (hour === 12) hour = 0;
  if (match[3].toLowerCase() === 'pm') hour += 12;
  const minutes = hour * 60 + minute;
  const band = minutes >= 5 * 60 && minutes < 8 * 60 ? 'dawn'
    : minutes >= 8 * 60 && minutes < 18 * 60 ? 'day'
      : minutes >= 18 * 60 && minutes < 21 * 60 ? 'dusk'
        : 'night';
  return { value: band, status: 'derived' };
}

function qualityStatus(field, value) {
  const normalized = text(value, 40, { required: true })?.toLowerCase();
  return QUALITY_STATUSES[field]?.has(normalized) ? normalized : undefined;
}

function emptyFieldCounts() {
  return { observed: 0, derived: 0, unresolved: 0, unavailable: 0 };
}

function summarizeQuality(items, invalidRows) {
  const fields = {
    weather: emptyFieldCounts(), timeBand: emptyFieldCounts(),
    bait: { observed: 0, none: 0, disabled: 0, unavailable: 0 },
    armor: { observed: 0, unavailable: 0 }
  };
  for (const item of items) {
    for (const field of Object.keys(fields)) {
      const status = item.captureQuality?.[field];
      if (Object.hasOwn(fields[field], status)) fields[field][status] += 1;
    }
  }
  return { acceptedRows: items.length, invalidRows, fields };
}

function qualityWarnings(dataQuality) {
  const warnings = [];
  if (dataQuality.invalidRows > 0) warnings.push({
    code: 'COLLECTOR_INVALID_ROWS', sourceKind: 'personal-catch-collector',
    message: `${dataQuality.invalidRows} collector ledger row${dataQuality.invalidRows === 1 ? '' : 's'} failed strict validation and ${dataQuality.invalidRows === 1 ? 'was' : 'were'} skipped.`
  });
  for (const [field, label] of [['weather', 'weather value'], ['timeBand', 'time value']]) {
    const count = dataQuality.fields[field].unresolved;
    if (count > 0) warnings.push({
      code: `COLLECTOR_${field === 'weather' ? 'WEATHER' : 'TIME'}_UNRESOLVED`,
      sourceKind: 'personal-catch-collector',
      message: `${count} accepted collector row${count === 1 ? '' : 's'} ${count === 1 ? 'has' : 'have'} an unresolved ${label}; no semantic value was invented.`
    });
  }
  return warnings;
}

function normalizeRow(row) {
  const schemaVersion = row?.schemaVersion;
  if (![1, 2].includes(schemaVersion)) return null;
  const rootKeys = schemaVersion === 2 ? ROOT_KEYS_V2 : ROOT_KEYS_V1;
  const contextKeys = schemaVersion === 2 ? CONTEXT_KEYS_V2 : CONTEXT_KEYS_V1;
  if (!exactKeys(row, rootKeys)) return null;
  if (!exactKeys(row.fish, FISH_KEYS) || !exactKeys(row.context, contextKeys) || !exactKeys(row.setup, SETUP_KEYS) || !exactKeys(row.source, SOURCE_KEYS)) return null;
  if (schemaVersion === 2 && !exactKeys(row.quality, QUALITY_KEYS)) return null;
  const id = text(row.eventId, 80, { required: true });
  const caughtAt = text(row.caughtAt, 40, { required: true });
  const sessionTag = text(row.sessionId, 160, { required: true });
  const fishName = text(row.fish.displayName, 120, { required: true });
  const variant = text(row.fish.variant, 40, { required: true })?.toLowerCase();
  const weightLb = measurement(row.fish.weightLb);
  const lengthIn = measurement(row.fish.lengthIn);
  if (!/^collectorcatch-[0-9a-f]{32}$/.test(id || '') || !Number.isFinite(Date.parse(caughtAt || '')) || !fishName || !sessionTag || !VARIANTS.has(variant) || weightLb === undefined || lengthIn === undefined) return null;
  if (!Array.isArray(row.setup.armor) || row.setup.armor.length > 16) return null;
  const armor = row.setup.armor.map(item => text(item, 120, { required: true }));
  if (armor.some(item => item === undefined)) return null;
  const optionalFields = [
    [row.context.locationName, 120], [row.context.subLocation, 120], [row.context.weather, 40], [row.context.timeBand, 40], [row.context.temperature, 40],
    [row.setup.pole, 120], [row.setup.reel, 120], [row.setup.line, 120], [row.setup.bait, 120], [row.setup.pet, 120],
    [row.fish.rarity, 40], [row.fish.size, 40],
    [row.source.collectorVersion, 40], [row.source.minecraftVersion, 40], [row.source.extrasVersion, 40]
  ];
  if (optionalFields.some(([value, max]) => text(value, max) === undefined)) return null;
  if (text(row.source.confidence, 40, { required: true }) !== 'observed') return null;
  const weatherRaw = schemaVersion === 2 ? text(row.context.weatherRaw, 40) : text(row.context.weather, 40);
  const timeText = schemaVersion === 2 ? text(row.context.timeText, 40) : text(row.context.timeBand, 40);
  const legacyWeather = semanticWeather(weatherRaw);
  const legacyTime = semanticTime(timeText);
  const captureQuality = schemaVersion === 2 ? {
    weather: qualityStatus('weather', row.quality.weather),
    timeBand: qualityStatus('timeBand', row.quality.timeBand),
    bait: qualityStatus('bait', row.quality.bait),
    armor: qualityStatus('armor', row.quality.armor)
  } : {
    weather: legacyWeather.status,
    timeBand: legacyTime.status,
    bait: text(row.setup.bait) == null ? 'unavailable' : 'observed',
    armor: armor.length ? 'observed' : 'unavailable'
  };
  if (Object.values(captureQuality).some(value => value === undefined)) return null;
  const weather = schemaVersion === 2 ? text(row.context.weather, 40)?.toLowerCase() ?? null : legacyWeather.value;
  const dayPhase = schemaVersion === 2 ? text(row.context.timeBand, 40)?.toLowerCase() ?? null : legacyTime.value;
  if ((weather != null && !WEATHERS.has(weather)) || (dayPhase != null && !DAY_PHASES.has(dayPhase))) return null;
  if (schemaVersion === 2) {
    if (['observed', 'derived'].includes(captureQuality.weather) !== (weather != null)) return null;
    if (['observed', 'derived'].includes(captureQuality.timeBand) !== (dayPhase != null)) return null;
  }
  return {
    id, caughtAt: new Date(caughtAt).toISOString(), fishName,
    locationName: text(row.context.locationName), subLocation: text(row.context.subLocation),
    weightLb, lengthIn, variant,
    rarity: text(row.fish.rarity, 40)?.toLowerCase() ?? null,
    sizeTier: text(row.fish.size, 40)?.toLowerCase() ?? null,
    weather, weatherRaw, dayPhase, timeText,
    temperature: text(row.context.temperature, 40),
    rod: text(row.setup.pole), reel: text(row.setup.reel), line: text(row.setup.line),
    baitText: text(row.setup.bait), armor, pet: text(row.setup.pet), sessionTag,
    collectorVersion: text(row.source.collectorVersion, 40), captureQuality,
    source: 'fishon-catch-collector'
  };
}

export function parseCollectorCatchEvents(input, { maxEvents = DEFAULT_MAX_EVENTS } = {}) {
  const byId = new Map();
  let invalidRows = 0;
  for (const line of String(input).split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const normalized = normalizeRow(JSON.parse(line));
      if (!normalized) { invalidRows += 1; continue; }
      byId.set(normalized.id, normalized);
    } catch {
      invalidRows += 1;
    }
  }
  const limit = Math.max(1, Math.min(DEFAULT_MAX_EVENTS, Math.floor(Number(maxEvents) || DEFAULT_MAX_EVENTS)));
  const items = [...byId.values()].slice(-limit);
  const dataQuality = summarizeQuality(items, invalidRows);
  return {
    items, invalidRows, dataQuality,
    collectorVersion: [...items].reverse().find(item => item.collectorVersion)?.collectorVersion ?? null
  };
}

function unavailable(reason) {
  return { schemaVersion: 1, available: false, reason, observedAt: null, source: null, invalidRows: 0, items: [] };
}

export async function readCollectorCatchCollection(
  { ledgerPath, maxBytes = DEFAULT_MAX_BYTES, maxEvents = DEFAULT_MAX_EVENTS } = {},
  dependencies = {}
) {
  const stat = dependencies.stat || fsStat;
  const readTail = dependencies.readTail || defaultReadTail;
  try {
    const details = await stat(ledgerPath);
    const boundedBytes = Math.max(1, Math.min(DEFAULT_MAX_BYTES, Math.floor(Number(maxBytes) || DEFAULT_MAX_BYTES)));
    const parsed = parseCollectorCatchEvents(await readTail(ledgerPath, boundedBytes), { maxEvents });
    const modifiedAt = details.mtime.toISOString();
    return {
      schemaVersion: 1, available: true, observedAt: modifiedAt, invalidRows: parsed.invalidRows,
      dataQuality: parsed.dataQuality,
      qualityWarnings: qualityWarnings(parsed.dataQuality),
      source: {
        kind: 'fishon-catch-collector', version: parsed.collectorVersion,
        state: parsed.invalidRows > 0 || parsed.dataQuality.fields.weather.unresolved > 0 || parsed.dataQuality.fields.timeBand.unresolved > 0 ? 'degraded' : 'live', modifiedAt,
        size: Number.isSafeInteger(details.size) ? details.size : null,
        redactedPath: '…/fishon-catch-collector/catches.jsonl'
      },
      items: parsed.items
    };
  } catch (error) {
    return unavailable(error?.code === 'ENOENT' ? 'collector-not-installed' : 'collector-ledger-unreadable');
  }
}

function semanticCatchKey(item) {
  const second = Number.isFinite(Date.parse(item?.caughtAt)) ? new Date(item.caughtAt).toISOString().slice(0, 19) : '';
  return [second, String(item?.fishName || '').trim().toLowerCase(), item?.weightLb ?? '', item?.lengthIn ?? ''].join('|');
}

export function mergePersonalCatchCollections(collector, log) {
  const collectorItems = collector?.available && Array.isArray(collector.items) ? collector.items : [];
  const collectorKeys = new Set(collectorItems.map(semanticCatchKey));
  const logItems = log?.available && Array.isArray(log.items) ? log.items.filter(item => !collectorKeys.has(semanticCatchKey(item))) : [];
  const items = [...logItems, ...collectorItems].sort((a, b) => String(a.caughtAt || '').localeCompare(String(b.caughtAt || '')));
  const observedTimes = [collector?.observedAt, log?.observedAt].filter(value => Number.isFinite(Date.parse(value))).sort();
  return {
    schemaVersion: 1,
    available: Boolean(collector?.available || log?.available),
    collectorAvailable: Boolean(collector?.available),
    observedAt: observedTimes.at(-1) || null,
    source: collector?.available ? collector.source : log?.source ?? null,
    collectorSource: collector?.source ?? null,
    logSource: log?.source ?? null,
    collectorDataQuality: collector?.dataQuality ?? null,
    collectorWarnings: Array.isArray(collector?.qualityWarnings) ? collector.qualityWarnings : [],
    invalidRows: Math.max(0, Number(collector?.invalidRows) || 0),
    items
  };
}
