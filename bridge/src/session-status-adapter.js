import { open, stat as fsStat } from 'node:fs/promises';

const DEFAULT_MAX_BYTES = 262144;
const FRESH_WINDOW_MS = 120000;

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

function markerTime(line, logModifiedAt) {
  const match = line.match(/^\[(\d{2}):(\d{2}):(\d{2})\]/);
  if (!match) return logModifiedAt;
  const date = new Date(logModifiedAt);
  date.setHours(Number(match[1]), Number(match[2]), Number(match[3]), 0);
  return date.toISOString();
}

function reduceMarkers(text, logModifiedAt) {
  let latest = null;
  let extrasVersion = null;
  for (const line of String(text).split(/\r?\n/)) {
    const version = line.match(/FishOnMC Extras(?: R)?[^\d]*(\d+\.\d+\.\d+(?:[+.-][\w.-]+)?)/i);
    if (version) extrasVersion = version[1];
    let type = null;
    if (/Connecting to (?:play\.)?fishonmc\.net(?:[, :]|$)/i.test(line)) type = 'connect';
    else if (/Disconnected from server|Connection Lost/i.test(line)) type = 'disconnect';
    else if (/\bStopping!\b|Stopping the game/i.test(line)) type = 'stop';
    if (type) latest = { type, at: markerTime(line, logModifiedAt) };
  }
  return { latest, extrasVersion };
}

function unavailable(code, message) {
  return {
    gameRunning: null,
    onFishOnMC: null,
    network: null,
    inference: 'unavailable',
    logModifiedAt: null,
    latestMarkerAt: null,
    extrasVersion: null,
    warnings: [{ code, message }]
  };
}

export async function readSessionStatus(
  { latestLogPath, now = () => new Date(), maxBytes = DEFAULT_MAX_BYTES } = {},
  dependencies = {}
) {
  const readTail = dependencies.readTail || defaultReadTail;
  const stat = dependencies.stat || fsStat;
  try {
    const details = await stat(latestLogPath);
    const logModifiedAt = details.mtime.toISOString();
    const text = await readTail(latestLogPath, Math.max(1, Math.floor(maxBytes)));
    const { latest, extrasVersion } = reduceMarkers(text, logModifiedAt);
    const ageMs = Math.max(0, new Date(now()).getTime() - details.mtime.getTime());
    if (ageMs > FRESH_WINDOW_MS) {
      return {
        gameRunning: null,
        onFishOnMC: null,
        network: null,
        inference: 'stale-log',
        logModifiedAt,
        latestMarkerAt: latest?.at ?? null,
        extrasVersion,
        warnings: [{ code: 'LOG_STALE', message: 'Minecraft session status is unavailable because the log is stale.' }]
      };
    }
    const status = {
      gameRunning: null,
      onFishOnMC: null,
      network: null,
      inference: latest ? 'log-marker' : 'unavailable',
      logModifiedAt,
      latestMarkerAt: latest?.at ?? null,
      extrasVersion,
      warnings: []
    };
    if (latest?.type === 'connect') {
      status.gameRunning = true;
      status.onFishOnMC = true;
      status.network = 'fishonmc';
    } else if (latest?.type === 'disconnect') {
      status.onFishOnMC = false;
    } else if (latest?.type === 'stop') {
      status.gameRunning = false;
      status.onFishOnMC = false;
    } else {
      status.warnings.push({ code: 'NO_SESSION_MARKER', message: 'No recent FishOnMC connection marker was found.' });
    }
    return status;
  } catch (error) {
    if (error?.code === 'ENOENT') return unavailable('LOG_MISSING', 'The Minecraft session log is not available.');
    return unavailable('LOG_UNREADABLE', 'The Minecraft session log could not be read.');
  }
}
