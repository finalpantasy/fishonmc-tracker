import { createHash } from 'node:crypto';
import { open, stat as fsStat } from 'node:fs/promises';

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_MAX_EVENTS = 2000;
const CATCH_PATTERN = /^\[(\d{2}):(\d{2}):(\d{2})\].*?: \[System\] \[CHAT\] PB! You just caught an? (\d+(?:\.\d+)?) pound, (\d+(?:\.\d+)?) inch (.+?)\s*$/;
const LOCATION_PATTERN = /^\[(\d{2}):(\d{2}):(\d{2})\].*?: \[System\] \[CHAT\] Location: ([\p{L}\p{N}][\p{L}\p{N} '\-&.]{0,118})\s*$/u;
const VARIANT_PATTERN = /^\[(\d{2}):(\d{2}):(\d{2})\].*?: \[System\] \[CHAT\] (ALBINO|MELANISTIC|TROPHY|FABLED|GIGANTIC)! You caught an? [\p{Co}\s]*(.+?)\s*$/u;

async function defaultReadTail(filePath, maxBytes) {
  const handle = await open(filePath, 'r');
  try {
    const details = await handle.stat();
    const length = Math.min(details.size, maxBytes);
    if (length <= 0) return '';
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, details.size - length);
    return buffer.toString('utf8');
  } finally {
    await handle.close();
  }
}

function timestampAt(parts, logModifiedAt) {
  const modified = new Date(logModifiedAt);
  const date = new Date(modified);
  date.setHours(Number(parts[1]), Number(parts[2]), Number(parts[3]), 0);
  if (date.getTime() - modified.getTime() > 12 * 60 * 60 * 1000) date.setDate(date.getDate() - 1);
  return date.toISOString();
}

function eventId({ caughtAt, fishName, weightLb, lengthIn }) {
  const canonical = `${caughtAt}|${fishName.toLocaleLowerCase('en-US')}|${weightLb}|${lengthIn}`;
  return `logcatch-${createHash('sha256').update(canonical).digest('hex').slice(0, 32)}`;
}

function clockSeconds(parts) {
  return (Number(parts[1]) * 60 * 60) + (Number(parts[2]) * 60) + Number(parts[3]);
}

export function parseCatchEvents(text, { logModifiedAt, maxEvents = DEFAULT_MAX_EVENTS } = {}) {
  const modifiedAt = new Date(logModifiedAt);
  if (!Number.isFinite(modifiedAt.getTime())) throw new TypeError('A valid log modification time is required.');
  const byId = new Map();
  let locationName = null;
  let pendingVariant = null;
  let lastCatch = null;
  for (const line of String(text).split(/\r?\n/)) {
    const location = line.match(LOCATION_PATTERN);
    if (location) {
      locationName = location[4].trim();
      continue;
    }
    const variant = line.match(VARIANT_PATTERN);
    if (variant) {
      const marker = { variant: variant[4].toLowerCase(), fishName: variant[5].trim(), seconds: clockSeconds(variant) };
      const age = lastCatch ? (marker.seconds - lastCatch.seconds + 86400) % 86400 : Infinity;
      if (lastCatch && age <= 10 && lastCatch.event.fishName.toLocaleLowerCase('en-US') === marker.fishName.toLocaleLowerCase('en-US')) {
        lastCatch.event.variant = marker.variant;
      } else {
        pendingVariant = marker;
      }
      continue;
    }
    const match = line.match(CATCH_PATTERN);
    if (!match) continue;
    const caughtAt = timestampAt(match, modifiedAt);
    const fishName = match[6].trim().slice(0, 120);
    const catchSeconds = clockSeconds(match);
    const variantAge = pendingVariant ? (catchSeconds - pendingVariant.seconds + 86400) % 86400 : Infinity;
    const matchedVariant = pendingVariant && variantAge <= 10 && pendingVariant.fishName.toLocaleLowerCase('en-US') === fishName.toLocaleLowerCase('en-US')
      ? pendingVariant.variant
      : 'normal';
    const event = {
      id: '',
      caughtAt,
      fishName,
      locationName,
      weightLb: Number(match[4]),
      lengthIn: Number(match[5]),
      variant: matchedVariant,
      source: 'minecraft-log'
    };
    event.id = eventId(event);
    byId.set(event.id, event);
    lastCatch = { event, seconds: catchSeconds };
    pendingVariant = null;
  }
  const limit = Math.max(1, Math.min(DEFAULT_MAX_EVENTS, Math.floor(Number(maxEvents) || DEFAULT_MAX_EVENTS)));
  return [...byId.values()].slice(-limit);
}

function unavailable(reason) {
  return { schemaVersion: 1, available: false, reason, observedAt: null, source: null, items: [] };
}

export async function readCatchCollection(
  { latestLogPath, maxBytes = DEFAULT_MAX_BYTES, maxEvents = DEFAULT_MAX_EVENTS } = {},
  dependencies = {}
) {
  const stat = dependencies.stat || fsStat;
  const readTail = dependencies.readTail || defaultReadTail;
  try {
    const details = await stat(latestLogPath);
    const boundedBytes = Math.max(1, Math.floor(Number(maxBytes) || DEFAULT_MAX_BYTES));
    const text = await readTail(latestLogPath, boundedBytes);
    const modifiedAt = details.mtime.toISOString();
    return {
      schemaVersion: 1,
      available: true,
      observedAt: modifiedAt,
      source: {
        kind: 'minecraft-catch-log', version: '1', state: 'live', modifiedAt,
        size: Number.isSafeInteger(details.size) ? details.size : null, redactedPath: '…/latest.log'
      },
      items: parseCatchEvents(text, { logModifiedAt: modifiedAt, maxEvents })
    };
  } catch (error) {
    return unavailable(error?.code === 'ENOENT' ? 'log-missing' : 'log-unreadable');
  }
}
