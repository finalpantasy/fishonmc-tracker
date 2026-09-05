(function (root) {
  'use strict';

  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

  async function refresh() {
    if (location.protocol === 'file:') {
      byId('diagnostics-updated-at').textContent = 'Live diagnostics are available when opened through the FishOnMC launcher.';
      byId('diagnostics-sources').innerHTML = '';
      byId('diagnostics-warnings').innerHTML = '';
      return;
    }
    try {
      const response = await fetch('/api/diagnostics', { cache: 'no-store' });
      if (!response.ok) throw new Error('unavailable');
      const data = await response.json();
      byId('diagnostics-updated-at').textContent = data.observedAt ? `Last checked ${new Date(data.observedAt).toLocaleString()}` : 'No live source timestamp available.';
      byId('diagnostics-sources').innerHTML = data.sources?.length ? data.sources.map(source => `<div class="diagnostic-row"><div><strong>${escapeHtml(source.kind)}</strong><small>${escapeHtml(source.redactedPath || '')}</small></div><span>${escapeHtml(source.version || 'version unknown')}</span><span class="live-badge" data-state="${escapeHtml(source.state)}">${escapeHtml(source.state)}</span><time>${source.modifiedAt ? escapeHtml(new Date(source.modifiedAt).toLocaleString()) : '—'}</time></div>`).join('') : '<p class="empty-state">No live source files discovered.</p>';
      byId('diagnostics-warnings').innerHTML = data.warnings?.length ? data.warnings.map(warning => `<div class="quality-item"><strong>${escapeHtml(warning.code)}</strong> ${escapeHtml(warning.message)}</div>`).join('') : '<div class="quality-item is-good">No bridge warnings.</div>';
    } catch {
      byId('diagnostics-updated-at').textContent = 'The local bridge is offline. Static Tracker content remains available.';
      byId('diagnostics-sources').innerHTML = '';
      byId('diagnostics-warnings').innerHTML = '';
    }
  }

  function init() {
    root.addEventListener('fishon:live-state', event => { if (event.detail?.snapshot) void refresh(); });
    void refresh();
  }

  root.FishOnDiagnostics = { init, refresh };
})(window);
