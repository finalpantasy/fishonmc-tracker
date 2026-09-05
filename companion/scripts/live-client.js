(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FishOnLiveClient = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const BACKOFF_MS = [1000, 2000, 5000, 10000, 30000];
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

  function create(options = {}) {
    const protocol = options.protocol || root.location?.protocol || 'file:';
    const fetchImpl = options.fetchImpl || root.fetch?.bind(root);
    const eventSourceFactory = options.eventSourceFactory || (url => new root.EventSource(url));
    const onState = typeof options.onState === 'function' ? options.onState : () => {};
    const timers = options.timers || { setTimeout: root.setTimeout.bind(root), clearTimeout: root.clearTimeout.bind(root) };
    const visibility = options.visibility || {
      isHidden: () => Boolean(root.document?.hidden),
      subscribe: callback => {
        const handler = () => callback(!root.document.hidden);
        root.document?.addEventListener('visibilitychange', handler);
        return () => root.document?.removeEventListener('visibilitychange', handler);
      }
    };
    let state = { mode: protocol === 'file:' ? 'file-offline' : 'bridge', status: 'connecting', snapshot: null, revision: 0, errorCode: null };
    let eventSource = null;
    let reconnectTimer = null;
    let reconnectIndex = 0;
    let unsubscribeVisibility = null;
    let stopped = false;

    function publish(patch) {
      state = { ...state, ...patch };
      onState(clone(state));
    }

    async function refresh() {
      if (protocol === 'file:' || stopped) return clone(state);
      try {
        const response = await fetchImpl('/api/snapshot', { cache: 'no-store' });
        if (!response?.ok) throw new Error('HTTP');
        const snapshot = await response.json();
        if (!snapshot || snapshot.schemaVersion !== 1 || !Number.isSafeInteger(snapshot.revision)) throw new Error('SCHEMA');
        reconnectIndex = 0;
        publish({ status: snapshot.freshness?.state || 'offline', snapshot, revision: snapshot.revision, errorCode: null });
      } catch {
        publish({ status: 'offline', snapshot: state.snapshot, errorCode: 'BRIDGE_UNAVAILABLE' });
      }
      return clone(state);
    }

    function closeEvents() {
      eventSource?.close?.();
      eventSource = null;
    }

    function scheduleReconnect() {
      closeEvents();
      if (stopped || visibility.isHidden()) return;
      if (reconnectTimer !== null) timers.clearTimeout(reconnectTimer);
      const delay = BACKOFF_MS[Math.min(reconnectIndex, BACKOFF_MS.length - 1)];
      reconnectIndex += 1;
      reconnectTimer = timers.setTimeout(async () => {
        reconnectTimer = null;
        if (stopped || visibility.isHidden()) return;
        await refresh();
        connectEvents();
      }, delay);
    }

    function connectEvents() {
      if (stopped || protocol === 'file:' || visibility.isHidden() || eventSource) return;
      eventSource = eventSourceFactory('/api/events');
      eventSource.addEventListener('snapshot', event => {
        try {
          const update = JSON.parse(event.data);
          if (Number.isSafeInteger(update.revision) && update.revision > state.revision) void refresh();
        } catch { /* Ignore malformed event metadata and retain the last valid state. */ }
      });
      eventSource.addEventListener('error', scheduleReconnect);
    }

    async function start() {
      stopped = false;
      if (protocol === 'file:') {
        publish({ mode: 'file-offline', status: 'offline', errorCode: null });
        return clone(state);
      }
      unsubscribeVisibility = visibility.subscribe(async visible => {
        if (!visible) { closeEvents(); return; }
        await refresh();
        connectEvents();
      });
      await refresh();
      connectEvents();
      return clone(state);
    }

    function stop() {
      stopped = true;
      closeEvents();
      if (reconnectTimer !== null) timers.clearTimeout(reconnectTimer);
      reconnectTimer = null;
      unsubscribeVisibility?.();
      unsubscribeVisibility = null;
    }

    return { start, stop, refresh, getState: () => clone(state) };
  }

  return { create };
});
