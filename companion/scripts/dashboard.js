(function (root) {
  'use strict';
  const appConfig = root.FISHON_APP_CONFIG || { hasGuide: true };

  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const number = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '—';
  const normalize = value => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ');

  function empty(text) { return `<p class="empty-state">${escapeHtml(text)}</p>`; }

  function measure(value, suffix, places = 2) {
    if (!Number.isFinite(Number(value))) return '—';
    return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: places })}${suffix}`;
  }

  function duration(minutes) {
    if (!Number.isFinite(Number(minutes))) return '—';
    const rounded = Math.max(0, Math.round(Number(minutes)));
    const hours = Math.floor(rounded / 60);
    const rest = rounded % 60;
    return hours ? `${hours}h ${rest}m` : `${rest}m`;
  }

  function clock(value) {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Time unknown';
  }

  function fishForName(name) {
    const key = normalize(name);
    return root.FISHON_DATA?.fish?.find(fish => normalize(fish.name) === key) || null;
  }

  function locationForName(name) {
    const key = normalize(name);
    return root.FISHON_DATA?.locations?.find(location => normalize(location.name) === key) || null;
  }

  function bindFishButtons() {
    document.querySelectorAll('[data-dashboard-fish]').forEach(button => button.addEventListener('click', () => {
      root.dispatchEvent(new CustomEvent('fishon:fish-selected', { detail: { fishId: button.dataset.dashboardFish, locationId: button.dataset.dashboardFishLocation || undefined } }));
    }));
  }

  function renderCatchInsights(catchInsights) {
    const targets = ['dashboard-session-kpis', 'dashboard-catch-timeline', 'dashboard-location-mix', 'dashboard-top-fish', 'dashboard-recent-catches'];
    if (!catchInsights?.available || catchInsights.eventCount === 0) {
      for (const id of targets) byId(id).innerHTML = empty('No exact personal catch events are available yet.');
      byId('dashboard-session-window').textContent = 'Waiting for a catch';
      byId('dashboard-location-count').textContent = '0 locations';
      return;
    }

    const improvement = catchInsights.biggestImprovement;
    const kpis = [
      { label: 'Observed catches', value: number(catchInsights.eventCount), note: 'Structured events plus PB fallback', featured: true },
      { label: 'Species seen', value: number(catchInsights.uniqueFish), note: `${number(catchInsights.uniqueLocations)} location${catchInsights.uniqueLocations === 1 ? '' : 's'}` },
      { label: 'Observed weight', value: measure(catchInsights.totalWeightLb, ' lb'), note: 'Sum of recorded catch weights' },
      { label: 'Mean weight', value: measure(catchInsights.meanWeightLb, ' lb'), note: 'Arithmetic mean' },
      { label: 'Catch pace', value: Number.isFinite(Number(catchInsights.pacePerHour)) ? `${measure(catchInsights.pacePerHour, '')}/hr` : '—', note: 'Across the captured time window' },
      { label: 'Heaviest catch', value: catchInsights.heaviest ? measure(catchInsights.heaviest.weightLb, ' lb') : '—', note: catchInsights.heaviest?.fishName || 'No weight observed' },
      { label: 'Longest catch', value: catchInsights.longest ? measure(catchInsights.longest.lengthIn, ' in') : '—', note: catchInsights.longest?.fishName || 'No length observed' },
      { label: 'Biggest jump', value: improvement ? `+${measure(improvement.gainLb, ' lb')}` : '—', note: improvement ? `${improvement.fishName} upward step` : 'Needs two measured catches for one species' }
    ];
    byId('dashboard-session-kpis').innerHTML = kpis.map(item => `<article class="session-kpi${item.featured ? ' is-featured' : ''}"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong><small>${escapeHtml(item.note)}</small></article>`).join('');

    byId('dashboard-session-window').textContent = `${duration(catchInsights.durationMinutes)} window`;
    const maximum = Math.max(1, ...catchInsights.timeline.map(item => item.count));
    byId('dashboard-catch-timeline').innerHTML = catchInsights.timeline.length ? `<div class="catch-timeline-bars${catchInsights.timeline.length < 6 ? ' is-sparse' : ''}" role="img" aria-label="Observed catches per time interval">${catchInsights.timeline.map(item => {
      const height = item.count ? Math.max(10, Math.round((item.count / maximum) * 100)) : 3;
      return `<div class="catch-timeline-slot" title="${escapeHtml(`${clock(item.at)}: ${item.count} catch${item.count === 1 ? '' : 'es'}`)}"><span class="catch-timeline-count">${item.count || ''}</span><i style="height:${height}%"></i><small>${escapeHtml(clock(item.at))}</small></div>`;
    }).join('')}</div>` : empty('A timeline appears after two timestamped catches.');

    byId('dashboard-location-count').textContent = `${number(catchInsights.uniqueLocations)} location${catchInsights.uniqueLocations === 1 ? '' : 's'}`;
    byId('dashboard-location-mix').innerHTML = catchInsights.locations.map(item => {
      const location = locationForName(item.label);
      return `<article class="dashboard-location-row"><span class="dashboard-location-art" style="background-image:url('${escapeHtml(location?.image || '')}')" aria-hidden="true"></span><div><div class="dashboard-row-title"><strong>${escapeHtml(item.label)}</strong><span>${number(item.count)} catch${item.count === 1 ? '' : 'es'} · ${measure(item.percent, '%', 1)}</span></div><div class="dashboard-share-track"><i style="width:${Math.max(2, item.percent)}%"></i></div></div></article>`;
    }).join('');

    byId('dashboard-top-fish').innerHTML = catchInsights.topFish.map((item, index) => {
      const fish = fishForName(item.label);
      return `<button class="dashboard-fish-leader" type="button"${fish ? ` data-dashboard-fish="${escapeHtml(fish.id)}" data-dashboard-fish-location="${escapeHtml(fish.locations?.[0]?.locationId || '')}"` : ' disabled'}><span class="leader-rank">${index + 1}</span><span class="leader-sprite">${fish ? `<img src="${escapeHtml(fish.image)}" alt="">` : ''}</span><span class="leader-copy"><strong>${escapeHtml(item.label)}</strong><small>${number(item.count)} catch${item.count === 1 ? '' : 'es'} · ${measure(item.totalWeightLb, ' lb')} observed</small></span><span class="leader-mean">${measure(item.meanWeightLb, ' lb')}<small>mean</small></span></button>`;
    }).join('');

    byId('dashboard-recent-catches').innerHTML = catchInsights.recent.map(event => {
      const fish = fishForName(event.fishName);
      const location = locationForName(event.locationName);
      return `<button class="dashboard-recent-catch" type="button"${fish ? ` data-dashboard-fish="${escapeHtml(fish.id)}" data-dashboard-fish-location="${escapeHtml(location?.id || fish.locations?.[0]?.locationId || '')}"` : ' disabled'}><span class="recent-sprite">${fish ? `<img src="${escapeHtml(fish.image)}" alt="">` : ''}</span><span class="recent-copy"><strong>${escapeHtml(event.fishName)}</strong><small>${escapeHtml(event.locationName || 'Location unavailable')} · ${escapeHtml(clock(event.caughtAt))}</small></span><span class="recent-measure"><strong>${measure(event.weightLb, ' lb')}</strong><small>${measure(event.lengthIn, ' in')}</small></span></button>`;
    }).join('');
    bindFishButtons();
  }

  function renderPersonalProgress() {
    const target = byId('dashboard-personal-progress');
    if (!target || !root.FishOnCatchStats || !root.ProgressStore || !root.FISHON_DATA) return;
    try {
      const stats = root.FishOnCatchStats.globalStats(root.FISHON_DATA, root.ProgressStore.load(), false);
      const percentage = Math.max(0, Math.min(100, Number(stats.completionPercent) || 0));
      target.innerHTML = `<div class="personal-completion"><strong>${measure(percentage, '%', 1)}</strong><span>location checklist</span><div class="live-progress" role="progressbar" aria-label="Fish collection completion" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percentage}"><i style="width:${percentage}%"></i></div><small>${number(stats.caughtAssociations)} of ${number(stats.totalAssociations)} fish-location entries caught</small></div><div class="personal-stat-grid"><div><span>Catch log</span><strong>${number(stats.totalLoggedCatches)}</strong></div><div><span>Mean weight</span><strong>${measure(stats.meanWeightLb, ' lb')}</strong></div><div><span>Heaviest</span><strong>${measure(stats.heaviest?.weightLb, ' lb')}</strong></div><div><span>Active days</span><strong>${number(stats.activeDays)}</strong></div></div>${stats.heaviest ? `<p class="personal-highlight">Biggest logged catch: <strong>${escapeHtml(stats.heaviest.fishName)}</strong></p>` : ''}`;
    } catch {
      target.innerHTML = empty('Personal progress is waiting for browser storage.');
    }
  }

  function renderBreakdown(targetId, items) {
    const target = byId(targetId);
    if (!target) return;
    const maximum = Math.max(1, ...items.map(item => item.value));
    target.innerHTML = items.length ? items.map(item => `<div class="live-breakdown-row"><span>${escapeHtml(item.label)}</span><div class="live-breakdown-track"><i style="width:${Math.round((item.value / maximum) * 100)}%"></i></div><strong>${number(item.value)}</strong></div>`).join('') : empty('No aggregate data available.');
  }

  function renderView(view, openTab) {
    const banner = byId('live-status-banner');
    banner.dataset.status = view.status;
    byId('live-status-label').textContent = view.statusLabel;
    byId('live-freshness').textContent = view.freshnessText;
    renderCatchInsights(view.catchInsights);
    renderPersonalProgress();

    byId('dashboard-next-actions').innerHTML = view.recommendations.length ? view.recommendations.map(item => `<article class="live-action"><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.reason)}</p><small>Basis: ${escapeHtml(item.evidence)}</small></div><button class="mc-button" type="button" data-live-action="${escapeHtml(item.id)}">Open</button></article>`).join('') : empty(appConfig.hasGuide ? 'No live next action is available. Open the Guide tab for the complete route.' : 'No live next action is available. Review My Progress for missing objectives.');
    byId('dashboard-next-actions').querySelectorAll('[data-live-action]').forEach(button => button.addEventListener('click', () => {
      const item = view.recommendations.find(candidate => candidate.id === button.dataset.liveAction);
      if (!item?.action) return;
      if (item.action.type === 'open-tab') openTab(item.action.tab);
      if (item.action.type === 'open-location') root.dispatchEvent(new CustomEvent('fishon:location-selected', { detail: { id: item.action.locationId } }));
      if (item.action.type === 'open-guide-mission') openTab(appConfig.hasGuide ? 'guide' : 'progress');
    }));

    byId('dashboard-quests').innerHTML = view.quests.length ? view.quests.map(quest => `<article class="live-quest"><div><strong>${escapeHtml(quest.title)}</strong><span>${number(quest.current)} / ${number(quest.target)}</span></div><div class="live-progress" role="progressbar" aria-label="${escapeHtml(quest.title)} progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${quest.percent}"><i style="width:${quest.percent}%"></i></div></article>`).join('') : empty('No active Extras quests are available.');

    const totalIds = { fish: 'dashboard-fish-total', pet: 'dashboard-pet-total', item: 'dashboard-item-total', questPet: 'dashboard-quest-pet-total', questItem: 'dashboard-quest-item-total' };
    for (const [key, id] of Object.entries(totalIds)) byId(id).textContent = view.totals ? number(view.totals[key]) : '—';
    renderBreakdown('dashboard-rarity-breakdown', view.breakdowns.rarity);
    renderBreakdown('dashboard-variant-breakdown', view.breakdowns.variant);
    renderBreakdown('dashboard-size-breakdown', view.breakdowns.size);
    byId('dashboard-profile-flags').innerHTML = view.profileFlags ? view.profileFlags.map(item => `<div><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></div>`).join('') : empty('Extras profile flags unavailable.');
    byId('dashboard-unavailable').innerHTML = view.unavailable.map(item => `<div class="unavailable-row"><span aria-hidden="true">□</span>${escapeHtml(item)}</div>`).join('');
  }

  function init({ openTab }) {
    const client = root.FishOnLiveClient.create({
      onState: state => {
        if (state.snapshot) {
          try {
            renderView(root.FishOnDashboardModel.fromSnapshot(state.snapshot), openTab);
            const result = root.FishOnCatchImporter.importCollection(root.FISHON_DATA, root.ProgressStore, state.snapshot.catches);
            const status = byId('log-import-status');
            if (result.available) {
              const sourceText = state.snapshot.catches?.collectorAvailable
                ? 'Structured collector tracking is active for exact personal catches, variants, sizes, conditions, and setup snapshots.'
                : 'PB-log fallback tracking is active; the approval-gated structured collector is not installed.';
              status.textContent = `${sourceText} ${result.total.toLocaleString()} normalized catch event${result.total === 1 ? '' : 's'} available; ${result.unresolved.toLocaleString()} could not be matched safely.`;
            } else {
              status.textContent = 'Automatic Minecraft catch tracking is waiting for a readable source. Manual catch logging remains available.';
            }
            if (result.added > 0) {
              root.dispatchEvent(new CustomEvent('fishon:progress-changed'));
              root.dispatchEvent(new CustomEvent('fishon:toast', { detail: `Imported ${result.added.toLocaleString()} Minecraft catch${result.added === 1 ? '' : 'es'} into My Progress.` }));
            }
            renderPersonalProgress();
          }
          catch { byId('live-status-label').textContent = 'Live data schema unavailable'; }
        } else {
          const offline = root.FishOnDashboardModel.fromSnapshot({ schemaVersion: 1, observedAt: null, connection: {}, profile: null, quests: [], aggregateStats: null, recommendations: [], freshness: { state: state.status === 'connecting' ? 'offline' : state.status }, warnings: [] });
          renderView(offline, openTab);
        }
        root.dispatchEvent(new CustomEvent('fishon:live-state', { detail: state }));
      }
    });
    byId('dashboard-diagnostics-link').addEventListener('click', () => {
      openTab('sources');
      root.FishOnDiagnostics?.refresh?.();
      setTimeout(() => byId('live-diagnostics')?.focus(), 0);
    });
    document.querySelectorAll('[data-dashboard-tab]').forEach(button => button.addEventListener('click', () => openTab(button.dataset.dashboardTab)));
    root.addEventListener('fishon:progress-changed', renderPersonalProgress);
    void client.start();
    return client;
  }

  root.FishOnDashboard = { init };
})(window);
