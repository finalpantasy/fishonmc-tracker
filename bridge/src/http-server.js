import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { loadPublicAssets } from './public-assets.js';

const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.md': 'text/markdown; charset=utf-8',
  '.woff2': 'font/woff2'
});

const JSON_HEADERS = Object.freeze({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });

function sanitizedWarning(warning) {
  return {
    code: String(warning?.code || 'UNKNOWN_WARNING').slice(0, 80),
    sourceKind: warning?.sourceKind ? String(warning.sourceKind).slice(0, 80) : null,
    message: String(warning?.message || 'A source warning occurred.').slice(0, 300)
  };
}

function sanitizedSource(source) {
  return {
    kind: String(source?.kind || 'unknown').slice(0, 80),
    version: source?.version == null ? null : String(source.version).slice(0, 40),
    state: String(source?.state || 'unavailable').slice(0, 40),
    modifiedAt: source?.modifiedAt || null,
    size: Number.isSafeInteger(source?.size) ? source.size : null,
    redactedPath: source?.redactedPath ? String(source.redactedPath).slice(0, 120) : null
  };
}

function sanitizedCollectorDataQuality(quality) {
  if (!quality || typeof quality !== 'object' || Array.isArray(quality)) return null;
  const boundedCount = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
  const allowedFields = {
    weather: ['observed', 'derived', 'unresolved', 'unavailable'],
    timeBand: ['observed', 'derived', 'unresolved', 'unavailable'],
    bait: ['observed', 'none', 'disabled', 'unavailable'],
    armor: ['observed', 'unavailable']
  };
  const fields = {};
  for (const [field, statuses] of Object.entries(allowedFields)) {
    if (!quality.fields?.[field]) continue;
    fields[field] = Object.fromEntries(statuses.map(status => [status, boundedCount(quality.fields[field][status])]));
  }
  return {
    acceptedRows: boundedCount(quality.acceptedRows),
    invalidRows: boundedCount(quality.invalidRows),
    fields
  };
}

function sendJson(response, status, value, head = false) {
  const body = JSON.stringify(value);
  response.writeHead(status, { ...JSON_HEADERS, 'Content-Length': Buffer.byteLength(body) });
  response.end(head ? undefined : body);
}

function unavailableCollection() {
  return { schemaVersion: 1, available: false, reason: 'collector-not-installed', items: [] };
}

function sanitizedCatch(item) {
  const number = value => Number.isFinite(Number(value)) && Number(value) >= 0 ? Number(value) : null;
  const base = {
    id: String(item?.id || '').slice(0, 160),
    caughtAt: item?.caughtAt || null,
    fishName: String(item?.fishName || '').slice(0, 120),
    locationName: item?.locationName == null ? null : String(item.locationName).slice(0, 120),
    weightLb: number(item?.weightLb),
    lengthIn: number(item?.lengthIn),
    variant: String(item?.variant || 'normal').slice(0, 40),
    source: 'minecraft-log'
  };
  if (item?.source !== 'fishon-catch-collector') return base;
  const optional = (value, max = 120) => value == null ? null : String(value).slice(0, max);
  return {
    ...base,
    subLocation: optional(item.subLocation),
    rarity: optional(item.rarity, 40),
    sizeTier: optional(item.sizeTier, 40),
    weather: optional(item.weather, 40),
    ...(item.weatherRaw != null ? { weatherRaw: optional(item.weatherRaw, 40) } : {}),
    dayPhase: optional(item.dayPhase, 40),
    ...(item.timeText != null ? { timeText: optional(item.timeText, 40) } : {}),
    temperature: optional(item.temperature, 40),
    rod: optional(item.rod),
    reel: optional(item.reel),
    line: optional(item.line),
    baitText: optional(item.baitText),
    armor: (Array.isArray(item.armor) ? item.armor : []).slice(0, 16).map(value => String(value).slice(0, 120)),
    pet: optional(item.pet),
    ...(item.captureQuality && typeof item.captureQuality === 'object' ? { captureQuality: {
      weather: optional(item.captureQuality.weather, 40),
      timeBand: optional(item.captureQuality.timeBand, 40),
      bait: optional(item.captureQuality.bait, 40),
      armor: optional(item.captureQuality.armor, 40)
    }} : {}),
    sessionTag: optional(item.sessionTag, 160),
    source: 'fishon-catch-collector'
  };
}

function sanitizedCatchCollection(collection) {
  if (!collection?.available) return {
    schemaVersion: 1, available: false, reason: String(collection?.reason || 'log-unavailable').slice(0, 80), items: []
  };
  return {
    schemaVersion: 1, available: true, observedAt: collection.observedAt || null,
    source: sanitizedSource(collection.source),
    dataQuality: sanitizedCollectorDataQuality(collection.collectorDataQuality ?? collection.dataQuality),
    items: (Array.isArray(collection.items) ? collection.items : []).map(sanitizedCatch).filter(item => item.id && item.fishName)
  };
}

export async function createGuideServer({
  host = '127.0.0.1', companionRoot, researchRoot, stateService,
  instanceFingerprint, manifestPath, maxSseClients = 8,
  serviceName = 'fishonmc-live-guide-bridge', serveResearchDocuments = true
} = {}) {
  if (host !== '127.0.0.1') throw new Error('FishOnMC guide server must bind to 127.0.0.1.');
  if (!/^[a-f0-9]{16}$/.test(instanceFingerprint || '')) throw new Error('A valid instance fingerprint is required.');
  const assets = await loadPublicAssets({ companionRoot, manifestPath });
  const documents = new Map(serveResearchDocuments ? [
    ['/docs/source-ledger.md', path.join(researchRoot, 'source-ledger.md')],
    ['/docs/current-patch-contradictions.md', path.join(researchRoot, 'current-patch-contradictions.md')],
    ['/docs/nile-release-2026-09-05.md', path.join(researchRoot, 'nile-release-2026-09-05.md')]
  ] : []);
  const sseClients = new Set();

  async function serveFile(response, filePath, head, noStore = false) {
    try {
      const body = await readFile(filePath);
      const contentType = CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      response.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': body.byteLength,
        'Cache-Control': noStore ? 'no-store' : 'public, max-age=3600'
      });
      response.end(head ? undefined : body);
    } catch {
      sendJson(response, 404, { error: 'not-found' }, head);
    }
  }

  function apiBody(pathname) {
    const snapshot = stateService.getSnapshot();
    const diagnosticState = stateService.getDiagnostics();
    if (pathname === '/api/health') return {
      service: serviceName, schemaVersion: 1, status: 'ok',
      instanceFingerprint, profileFingerprint: snapshot?.profileFingerprint ?? null,
      revision: snapshot?.revision ?? 0, observedAt: snapshot?.observedAt ?? new Date(0).toISOString(),
      sourceState: snapshot?.freshness?.state ?? 'offline'
    };
    if (pathname === '/api/snapshot') return snapshot;
    if (pathname === '/api/quests') return {
      schemaVersion: 1, revision: snapshot?.revision ?? 0, observedAt: snapshot?.observedAt ?? null,
      source: sanitizedSource((diagnosticState?.sources || []).find(source => source.kind === 'extras-quest')),
      items: snapshot?.quests || []
    };
    if (pathname === '/api/stats') return {
      schemaVersion: 1, revision: snapshot?.revision ?? 0, observedAt: snapshot?.observedAt ?? null,
      source: sanitizedSource((diagnosticState?.sources || []).find(source => source.kind === 'extras-stats')),
      totals: snapshot?.aggregateStats?.totals || {},
      breakdowns: {
        rarity: snapshot?.aggregateStats?.fish?.byRarity || {},
        variant: snapshot?.aggregateStats?.fish?.byVariant || {},
        size: snapshot?.aggregateStats?.fish?.bySize || {}
      }
    };
    if (pathname === '/api/recommendations') return {
      schemaVersion: 1, revision: snapshot?.revision ?? 0, observedAt: snapshot?.observedAt ?? null,
      items: snapshot?.recommendations || []
    };
    if (pathname === '/api/diagnostics') return {
      schemaVersion: 1, revision: diagnosticState?.revision ?? 0,
      observedAt: diagnosticState?.observedAt ?? null,
      instanceFingerprint, profileFingerprint: snapshot?.profileFingerprint ?? null,
      sources: (diagnosticState?.sources || []).map(sanitizedSource),
      collectorDataQuality: sanitizedCollectorDataQuality(diagnosticState?.collectorDataQuality),
      warnings: (diagnosticState?.warnings || []).map(sanitizedWarning)
    };
    if (pathname === '/api/catches') return sanitizedCatchCollection(snapshot?.catches);
    if (pathname === '/api/records') return unavailableCollection();
    return null;
  }

  function handleSse(request, response) {
    if (sseClients.size >= maxSseClients) return sendJson(response, 503, { error: 'too-many-event-clients' });
    response.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive'
    });
    response.write(`event: ready\ndata: ${JSON.stringify({ revision: stateService.getSnapshot()?.revision ?? 0 })}\n\n`);
    const onSnapshot = event => response.write(`event: snapshot\ndata: ${JSON.stringify({ revision: event.revision, changedAreas: event.changedAreas, observedAt: event.observedAt })}\n\n`);
    const keepalive = setInterval(() => response.write(': keepalive\n\n'), 20000);
    keepalive.unref?.();
    const cleanup = () => {
      clearInterval(keepalive);
      stateService.off('snapshot', onSnapshot);
      sseClients.delete(response);
    };
    sseClients.add(response);
    stateService.on('snapshot', onSnapshot);
    request.once('close', cleanup);
    response.once('close', cleanup);
  }

  const server = http.createServer(async (request, response) => {
    const head = request.method === 'HEAD';
    if (request.method !== 'GET' && !head) {
      response.setHeader('Allow', 'GET, HEAD');
      return sendJson(response, 405, { error: 'method-not-allowed' });
    }
    let pathname;
    try {
      const rawPath = String(request.url || '/').split('?')[0];
      const decoded = decodeURIComponent(rawPath);
      if (decoded.split('/').includes('..') || decoded.includes('\\')) return sendJson(response, 404, { error: 'not-found' }, head);
      pathname = new URL(request.url || '/', 'http://127.0.0.1').pathname;
    } catch {
      return sendJson(response, 400, { error: 'bad-request' }, head);
    }
    if (pathname === '/api/events') {
      if (head) return sendJson(response, 200, { available: true }, true);
      return handleSse(request, response);
    }
    if (pathname.startsWith('/api/')) {
      const body = apiBody(pathname);
      return body === null ? sendJson(response, 404, { error: 'not-found' }, head) : sendJson(response, 200, body, head);
    }
    const documentPath = documents.get(pathname);
    if (documentPath) return serveFile(response, documentPath, head, true);
    const assetPath = assets.get(pathname === '/' ? '/index.html' : pathname);
    if (!assetPath) return sendJson(response, 404, { error: 'not-found' }, head);
    return serveFile(response, assetPath, head, pathname === '/' || pathname === '/index.html');
  });

  return Object.freeze({
    listen(port) {
      return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(port, host, () => {
          server.off('error', reject);
          resolve(server.address());
        });
      });
    },
    address: () => server.address(),
    close() {
      for (const response of sseClients) response.destroy();
      return new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    },
    server
  });
}
