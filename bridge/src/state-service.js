import { EventEmitter } from 'node:events';

const DEFAULT_TIMERS = {
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout,
  setInterval: globalThis.setInterval,
  clearInterval: globalThis.clearInterval
};

const clone = value => value == null ? value : structuredClone(value);

function publicError(error) {
  const code = ['PROFILE_NOT_FOUND', 'PROFILE_SELECTION_REQUIRED', 'SOURCE_MALFORMED', 'SOURCE_UNREADABLE'].includes(error?.code)
    ? error.code
    : 'EXTRAS_UNAVAILABLE';
  const messages = {
    PROFILE_NOT_FOUND: 'FishOnMC Extras profile data is not available.',
    PROFILE_SELECTION_REQUIRED: 'Multiple Extras profiles exist; select one in the launcher.',
    SOURCE_MALFORMED: 'An Extras source is malformed; the last valid snapshot is retained.',
    SOURCE_UNREADABLE: 'An Extras source could not be read; the last valid snapshot is retained.',
    EXTRAS_UNAVAILABLE: 'FishOnMC Extras data is temporarily unavailable.'
  };
  return { code, sourceKind: 'extras', message: messages[code] };
}

function freshnessFor({ extras, extrasError, hadLastExtras }) {
  if (extras) {
    const states = Object.values(extras.sources || {}).map(source => source?.state).filter(Boolean);
    if (!states.length || states.every(state => state === 'live')) return 'live';
    if (states.some(state => state === 'live') || hadLastExtras) return 'stale';
    return 'offline';
  }
  if (hadLastExtras) return 'stale';
  if (extrasError?.code === 'PROFILE_SELECTION_REQUIRED') return 'selection-required';
  return 'offline';
}

function retainFailedAreas(current, previous) {
  const merged = clone(current);
  const areas = [
    ['extras-profile', 'profile', null],
    ['extras-quest', 'quests', []],
    ['extras-stats', 'aggregateStats', null]
  ];
  for (const [sourceKind, property, unavailableValue] of areas) {
    const source = current?.sources?.[sourceKind];
    if (!source || source.state === 'live') continue;
    merged[property] = previous ? clone(previous[property]) : clone(unavailableValue);
  }
  return merged;
}

function meaningful(value) {
  if (!value) return value;
  const copy = clone(value);
  delete copy.revision;
  delete copy.observedAt;
  if (copy.connection) delete copy.connection.dataAgeMs;
  if (copy.catches) {
    delete copy.catches.observedAt;
    for (const key of ['source', 'collectorSource', 'logSource']) {
      if (!copy.catches[key]) continue;
      delete copy.catches[key].modifiedAt;
      delete copy.catches[key].size;
    }
  }
  return copy;
}

export function createStateService({
  extrasAdapter,
  sessionAdapter,
  recommendations,
  watchFactory = null,
  now = () => new Date(),
  timers = DEFAULT_TIMERS,
  rediscoveryMs = 2000,
  debounceMs = 150
} = {}) {
  if (typeof extrasAdapter?.readSnapshot !== 'function') throw new TypeError('Extras adapter is required.');
  if (typeof sessionAdapter?.readStatus !== 'function') throw new TypeError('Session adapter is required.');
  if (typeof recommendations !== 'function') throw new TypeError('Recommendation builder is required.');
  const emitter = new EventEmitter();
  let snapshot = null;
  let diagnostics = { schemaVersion: 1, revision: 0, sources: [], warnings: [] };
  let lastExtras = null;
  let intervalHandle = null;
  let watchHandle = null;
  let debounceHandle = null;
  let started = false;

  async function refresh() {
    let extras = null;
    let extrasError = null;
    const previousExtras = lastExtras;
    try {
      extras = await extrasAdapter.readSnapshot();
      extras = retainFailedAreas(extras, previousExtras);
      const hasLiveSource = Object.values(extras.sources || {}).some(source => source?.state === 'live');
      if (hasLiveSource || previousExtras) lastExtras = extras;
    } catch (error) {
      extrasError = error;
    }
    const [session, catches] = await Promise.all([
      sessionAdapter.readStatus(),
      typeof sessionAdapter.readCatches === 'function'
        ? sessionAdapter.readCatches()
        : Promise.resolve({ schemaVersion: 1, available: false, reason: 'collector-not-installed', observedAt: null, source: null, items: [] })
    ]);
    const retainedExtras = extras || lastExtras;
    const freshnessState = freshnessFor({ extras, extrasError, hadLastExtras: Boolean(previousExtras) });
    const warnings = [
      ...(retainedExtras?.warnings || []),
      ...(session?.warnings || []),
      ...(catches?.collectorWarnings || []),
      ...(extrasError ? [publicError(extrasError)] : [])
    ];
    const observedAt = new Date(now()).toISOString();
    const sourceTimes = Object.values(retainedExtras?.sources || {}).map(source => Date.parse(source.modifiedAt)).filter(Number.isFinite);
    const newestSourceTime = sourceTimes.length ? Math.max(...sourceTimes) : null;
    const dataAgeMs = newestSourceTime === null ? null : Math.max(0, Date.parse(observedAt) - newestSourceTime);
    const next = {
      schemaVersion: 1,
      revision: snapshot?.revision || 0,
      observedAt,
      connection: {
        gameRunning: session?.gameRunning ?? null,
        onFishOnMC: session?.onFishOnMC ?? null,
        network: session?.network ?? null,
        inference: session?.inference ?? 'unavailable',
        extrasVersion: session?.extrasVersion ?? null,
        dataAgeMs
      },
      profileFingerprint: retainedExtras?.profileFingerprint ?? null,
      profile: retainedExtras?.profile ?? null,
      quests: retainedExtras?.quests ?? [],
      aggregateStats: retainedExtras?.aggregateStats ?? null,
      catches,
      equipment: null,
      recommendations: recommendations({ quests: retainedExtras?.quests ?? [], aggregateStats: retainedExtras?.aggregateStats ?? null }),
      freshness: { state: freshnessState, staleAfterMs: 10000 },
      warnings
    };
    const personalCatchDiagnosticSources = catches?.collectorSource ? [{
      ...clone(catches.collectorSource), kind: 'personal-catch-collector'
    }] : [];
    const changed = JSON.stringify(meaningful(next)) !== JSON.stringify(meaningful(snapshot));
    if (changed) {
      next.revision = (snapshot?.revision || 0) + 1;
      snapshot = next;
      diagnostics = {
        schemaVersion: 1,
        revision: next.revision,
        observedAt,
        profileFingerprint: next.profileFingerprint,
        sources: [...Object.values(retainedExtras?.sources || {}).map(source => clone(source)), ...personalCatchDiagnosticSources],
        collectorDataQuality: clone(catches?.collectorDataQuality ?? null),
        warnings: clone(warnings)
      };
      emitter.emit('snapshot', { revision: next.revision, changedAreas: ['connection', 'profile', 'quests', 'aggregateStats', 'catches', 'recommendations', 'freshness'], observedAt });
    } else if (snapshot) {
      next.revision = snapshot.revision;
      snapshot = next;
    }
    return clone(snapshot);
  }

  function scheduleRefresh() {
    if (debounceHandle !== null) timers.clearTimeout(debounceHandle);
    debounceHandle = timers.setTimeout(async () => {
      debounceHandle = null;
      await refresh();
    }, debounceMs);
  }

  async function start() {
    if (started) return clone(snapshot);
    started = true;
    await refresh();
    if (watchFactory) watchHandle = watchFactory(scheduleRefresh);
    intervalHandle = timers.setInterval(() => refresh(), rediscoveryMs);
    intervalHandle?.unref?.();
    return clone(snapshot);
  }

  function stop() {
    if (debounceHandle !== null) timers.clearTimeout(debounceHandle);
    if (intervalHandle !== null) timers.clearInterval(intervalHandle);
    watchHandle?.close?.();
    debounceHandle = null;
    intervalHandle = null;
    watchHandle = null;
    started = false;
  }

  emitter.refresh = refresh;
  emitter.start = start;
  emitter.stop = stop;
  emitter.getSnapshot = () => clone(snapshot);
  emitter.getDiagnostics = () => clone(diagnostics);
  return emitter;
}
