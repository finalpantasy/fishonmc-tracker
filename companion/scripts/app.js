(function (root) {
  'use strict';

  const data = root.FISHON_DATA;
  if (!data) return;
  const appConfig = root.FISHON_APP_CONFIG || { productName: 'FishOnMC Field Guide', hasGuide: true, publicMode: false };

  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const MIGRATION_DISMISS_KEY = 'fishonmc-origin-migration-dismissed-v1';
  const CATALOG_PREVIEW_LIMIT = 12;
  let toastTimer;
  let catalogExpanded = false;
  const formatUnlockLevel = value => Number.isFinite(value) ? `Lv ${value}` : 'Unlock level pending';

  function showToast(message) {
    const toast = byId('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2600);
  }

  function setBackdrop(location) {
    if (!location?.image) return;
    document.documentElement.style.setProperty('--world-image', `url("${new URL(location.image, document.baseURI).href}")`);
    byId('footer-location').textContent = `${location.name} backdrop`;
  }

  function openTab(name, focus = false) {
    document.querySelectorAll('[data-tab]').forEach(tab => {
      const active = tab.dataset.tab === name;
      tab.classList.toggle('is-active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    document.querySelectorAll('[data-panel]').forEach(panel => {
      const active = panel.dataset.panel === name;
      panel.classList.toggle('is-active', active);
      panel.hidden = !active;
    });
    try { history.replaceState(null, '', `#${name}`); } catch { /* file URLs can decline history writes */ }
  }

  function initTabs() {
    const tabs = [...document.querySelectorAll('[data-tab]')];
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => openTab(tab.dataset.tab));
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        openTab(tabs[nextIndex].dataset.tab, true);
      });
    });
    document.querySelectorAll('[data-go-tab]').forEach(button => button.addEventListener('click', () => openTab(button.dataset.goTab)));
  }

  function fillSelect(select, options) {
    select.innerHTML = options.map(option => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`).join('');
  }

  function fishAt(locationId) {
    return data.fish.filter(fish => fish.locations.some(location => location.locationId === locationId));
  }

  function updateSetupFish(preferredFishId = '') {
    const locationId = byId('setup-location').value;
    const fish = fishAt(locationId).sort((a, b) => a.name.localeCompare(b.name));
    fillSelect(byId('setup-fish'), fish.map(item => ({ value: item.id, label: `${item.name}${item.locations.some(location => location.locationId === locationId && location.eventOnly) ? ' — historical event' : ''}` })));
    if (fish.some(item => item.id === preferredFishId)) byId('setup-fish').value = preferredFishId;
    renderSetup();
  }

  function formatBaitMetric(metric, kind) {
    if (metric.value == null) return kind === 'likelihood' ? 'Not published' : 'None listed';
    const sign = kind === 'likelihood' ? '' : metric.value > 0 ? '+' : '';
    const suffix = kind === 'biteSpeed' ? '' : '%';
    return `${sign}${metric.value}${suffix}`;
  }

  function formatLureProfile(profile) {
    return String(profile).replace(/(oz|in)$/i, ' $1');
  }

  function baitTargetLabel(recommendation, fish, association) {
    if (recommendation.rank === 4) return `${fish.name} · species`;
    if (recommendation.rank === 3) return `${association.group} · fish group`;
    if (recommendation.rank === 2) return `${association.locationName} · location`;
    return `${association.water} · water type`;
  }

  function renderBaitAnswer(fish, association, recommendations) {
    const eventWarning = association.eventOnly
      ? '<p class="notice"><strong>Historical/event-only target.</strong> This fish is not currently obtainable outside a returning event.</p>'
      : '';
    const choices = recommendations.length
      ? recommendations.map(recommendation => `<article class="setup-bait-choice">
          <div class="setup-bait-choice-reasons">${recommendation.reasons.map(reason => `<span>${escapeHtml(reason)}</span>`).join('')}</div>
          <div class="setup-bait-choice-main"><img src="${escapeHtml(recommendation.bait.image)}" alt=""><h2>${escapeHtml(recommendation.bait.name)}</h2></div>
          <dl class="bait-metric-list">
            ${recommendation.profile ? `<div><dt>Lure size</dt><dd>${escapeHtml(formatLureProfile(recommendation.profile))}</dd></div>` : ''}
            <div><dt>Bite Speed</dt><dd>${escapeHtml(formatBaitMetric(recommendation.metrics.biteSpeed, 'biteSpeed'))}</dd></div>
            <div><dt>Likelihood</dt><dd>${escapeHtml(formatBaitMetric(recommendation.metrics.likelihood, 'likelihood'))}</dd></div>
            <div><dt>Size</dt><dd>${escapeHtml(formatBaitMetric(recommendation.metrics.size, 'size'))}</dd></div>
            <div><dt>Target</dt><dd>${escapeHtml(baitTargetLabel(recommendation, fish, association))}</dd></div>
          </dl>
          <p class="setup-bait-why"><strong>Why use it:</strong> ${escapeHtml(recommendation.why)}</p>
          ${recommendation.caveat ? `<p class="setup-bait-caveat"><strong>Broad targeting:</strong> ${escapeHtml(recommendation.caveat)}</p>` : ''}
          <span class="evidence-label">${escapeHtml(recommendation.evidence)}</span>
        </article>`).join('')
      : '<div class="setup-bait-empty" role="status"><strong>No direct published match</strong><p>Check the live tacklebox tooltip. The Tracker will not invent a per-fish probability or unsupported favorite.</p></div>';
    byId('setup-bait-answer').innerHTML = `${eventWarning}<div class="setup-bait-choices">${choices}</div><p class="setup-answer-note"><strong>How to read this:</strong> Higher Bite Speed is faster. Published “Likelihood” is an item modifier, not an exact per-fish catch probability. A lure card uses one exact published size profile for every stat shown; confirm that size on the live item tooltip.</p>`;
  }

  function renderSetup() {
    const locationId = byId('setup-location').value;
    const fish = data.fish.find(item => item.id === byId('setup-fish').value);
    const goal = byId('setup-goal').value;
    if (!fish) {
      byId('setup-bait-answer').innerHTML = '<p class="empty-state">Choose a fish.</p>';
      byId('setup-output').innerHTML = '<p class="empty-state">Choose a fish.</p>';
      return;
    }
    const association = fish.locations.find(location => location.locationId === locationId) || fish.locations[0];
    const setup = root.FishOnSetups.forFish(data, fish, association.locationId, goal);
    const baits = root.FishOnSetups.rankBaits(data, fish, association).slice(0, 8);
    const recommendations = root.FishOnSetups.recommendBaits(data, fish, association, goal, 6);
    renderBaitAnswer(fish, association, recommendations);
    const observedOptimizer = renderObservedOptimizer(fish, association);
    const eventWarning = association.eventOnly ? `<p class="notice"><strong>Historical/event-only target.</strong> This setup is archival and the fish is not currently obtainable outside a returning event.${fish.eventOdds ? ` Its published historical event condition was 1 / ${fish.eventOdds.denominator.toLocaleString()}: ${escapeHtml(fish.eventOdds.condition)}.` : ''}</p>` : '';
    const gearCards = setup.map(item => `<article class="recommendation-card"><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.text)}</p><div class="recommendation-source">Basis: ${escapeHtml(item.source)}</div></article>`).join('');
    const baitMatches = baits.length
      ? `<div class="bait-match-grid">${baits.map(({ bait, evidence }) => `<article class="bait-match"><img src="${escapeHtml(bait.image)}" alt=""><div><strong>${escapeHtml(bait.name)}</strong><small>${escapeHtml(bait.effects.join(' • '))}</small>${bait.dataQuality.length ? `<small class="data-warning">${escapeHtml(bait.dataQuality.join(' • '))}</small>` : ''}</div><span class="evidence-label">${escapeHtml(evidence)}</span></article>`).join('')}</div>`
      : '<p class="notice info">No explicit direct match was parsed. Check the live tacklebox tooltip.</p>';
    byId('setup-output').innerHTML = `<div class="setup-target"><img src="${escapeHtml(fish.image)}" alt=""><div><span class="field-label">Target at ${escapeHtml(association.locationName)}</span><h2>${escapeHtml(fish.name)}</h2><p>${escapeHtml(association.rarity)} • ${escapeHtml(association.group)} • ${escapeHtml(goal)}</p></div></div>${eventWarning}
      <div class="setup-recommendation-grid">${gearCards}</div>
      <section class="setup-match-section"><div class="setup-subsection-heading"><div><span class="field-label">Published targeting</span><h2>Highest-confidence bait matches</h2></div><p>Use these if owned. Package-source locations describe where an item can come from; they are not treated as targeting effects.</p></div>${baitMatches}</section>
      ${observedOptimizer}`;
  }

  function renderObservedOptimizer(fish, association) {
    const plan = root.FishOnSetupOptimizer?.planTargetFish(data, root.ProgressStore.load(), fish.id);
    const location = plan?.locations?.find(item => item.locationId === association.locationId);
    const observed = location?.observed;
    if (!observed?.setups?.length) return `<section class="observed-optimizer"><div class="observed-optimizer-heading"><div><span class="field-label">Personal analytics</span><h2>Observed setup evidence</h2></div><span class="evidence-label">Waiting for complete setup rows</span></div><p>This is the observed share of your logged catches at this location, not an official catch chance. Record rod, reel, line, bait, armor, and pet to unlock comparisons.</p></section>`;
    const percent = value => value == null ? '—' : `${(value * 100).toFixed(1)}%`;
    return `<section class="observed-optimizer"><div class="observed-optimizer-heading"><div><span class="field-label">Personal analytics</span><h2>Observed setup evidence</h2></div><span class="evidence-label">${observed.eligibleCatchCount.toLocaleString()} complete sample${observed.eligibleCatchCount === 1 ? '' : 's'}</span></div><p>This is the observed share of your logged catches at this location, not an official catch chance. It is directional evidence, not proof that a setup caused the result.</p><div class="observed-setup-list">${observed.setups.slice(0, 6).map((setup, index) => `<article class="observed-setup-row"><strong>#${index + 1} ${escapeHtml(setup.rod)} + ${escapeHtml(setup.reel)}</strong><span>${setup.successCount.toLocaleString()} target / ${setup.sampleCount.toLocaleString()} catches</span><small>${percent(setup.observedShare)} observed share • 95% range ${percent(setup.lower95)}–${percent(setup.upper95)} • ${setup.rankable ? 'directional sample' : 'insufficient sample (<20)'}</small><em>${escapeHtml(setup.line)} • ${escapeHtml(setup.bait)} • ${escapeHtml(setup.armor)} • ${escapeHtml(setup.pet)}</em></article>`).join('')}</div>${observed.skippedIncomplete ? `<p class="observed-skip-note">${observed.skippedIncomplete.toLocaleString()} location catch${observed.skippedIncomplete === 1 ? '' : 'es'} excluded because the setup snapshot was incomplete.</p>` : ''}</section>`;
  }

  function renderBaits() {
    const query = byId('bait-search').value.trim().toLowerCase();
    const baits = data.baits.filter(bait => !query || [bait.name, bait.kind, bait.rarity, ...bait.effects, ...bait.targetGroups, ...bait.targetSpecies].join(' ').toLowerCase().includes(query));
    const visibleBaits = query || catalogExpanded ? baits : baits.slice(0, CATALOG_PREVIEW_LIMIT);
    const count = byId('bait-result-count');
    count.textContent = query
      ? `${baits.length.toLocaleString()} match${baits.length === 1 ? '' : 'es'}`
      : catalogExpanded ? `Showing all ${baits.length.toLocaleString()}` : `Showing ${visibleBaits.length.toLocaleString()} of ${baits.length.toLocaleString()}`;
    const showAll = byId('bait-show-all');
    showAll.hidden = Boolean(query) || baits.length <= CATALOG_PREVIEW_LIMIT;
    showAll.textContent = catalogExpanded ? 'Show fewer' : `Show all ${baits.length.toLocaleString()}`;
    showAll.setAttribute('aria-expanded', String(catalogExpanded));
    byId('bait-results').innerHTML = visibleBaits.map(bait => `<article class="bait-row"><img src="${escapeHtml(bait.image)}" alt=""><div><strong>${escapeHtml(bait.name)}</strong><br><small>${escapeHtml(bait.kind)} • ${escapeHtml(bait.rarity)}${bait.uses ? ` • ${bait.uses} uses` : ''}</small></div><div>${escapeHtml(bait.effects.join(' • ') || 'No effect text parsed')}<br><small>Package availability: ${escapeHtml(bait.sourceLocations.join(', ') || 'broad / unspecified')}</small>${bait.dataQuality.length ? `<small class="data-warning">${escapeHtml(bait.dataQuality.join(' • '))}</small>` : ''}</div></article>`).join('') || '<p class="empty-state">No tackle matches that search.</p>';
  }

  function initSetups() {
    fillSelect(byId('setup-location'), data.locations.map(location => ({ value: location.id, label: `${location.name} — ${formatUnlockLevel(location.unlockLevel)}` })));
    byId('setup-location').addEventListener('change', () => { updateSetupFish(); setBackdrop(data.locations.find(location => location.id === byId('setup-location').value)); });
    byId('setup-fish').addEventListener('change', renderSetup);
    byId('setup-goal').addEventListener('change', renderSetup);
    byId('bait-search').addEventListener('input', renderBaits);
    byId('bait-show-all').addEventListener('click', () => { catalogExpanded = !catalogExpanded; renderBaits(); });
    document.querySelectorAll('[data-setup-jump]').forEach(button => button.addEventListener('click', () => {
      byId(button.dataset.setupJump)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }));
    updateSetupFish();
    renderBaits();
  }

  function initSources() {
    const permanentAssociations = data.fish.flatMap(fish => fish.locations).filter(location => !location.eventOnly).length;
    byId('source-summary').innerHTML = [
      ['Species', data.fish.length], ['Fish-location rows', data.validation.totalLocationRows], ['Permanent rows', permanentAssociations], ['Baits & lures', data.baits.length]
    ].map(([label, value]) => `<div class="source-stat"><strong>${Number(value).toLocaleString()}</strong><span>${escapeHtml(label)}</span></div>`).join('');
    const labels = { locations: 'Official locations index', fishing: 'Official fishing mechanics', fishingStats: 'Official fishing stats', variants: 'Official variants', events: 'Official events and historical conditional odds', tacklebox: 'Official tacklebox', rules: 'Official server rules' };
    const sourceLedger = location.protocol === 'file:' ? '../research/source-ledger.md' : '/docs/source-ledger.md';
    const contradictionsLedger = location.protocol === 'file:' ? '../research/current-patch-contradictions.md' : '/docs/current-patch-contradictions.md';
    const nileReleaseLedger = location.protocol === 'file:' ? '../research/nile-release-2026-09-05.md' : '/docs/nile-release-2026-09-05.md';
    const publicLinks = Object.entries(labels).map(([key, label]) => `<li><a href="${escapeHtml(data.sources[key])}" target="_blank" rel="noreferrer">${escapeHtml(label)}</a></li>`).join('');
    byId('source-links').innerHTML = publicLinks + (appConfig.publicMode ? '' : `<li><a href="${sourceLedger}" target="_blank">Local source ledger</a></li><li><a href="${contradictionsLedger}" target="_blank">Current-patch contradictions ledger</a></li><li><a href="${nileReleaseLedger}" target="_blank">Nile River release evidence</a></li>`);
    const projects = root.FishOnProjects.catalog;
    byId('project-links').innerHTML = projects.map(project => `<article class="project-card">
      <div class="project-card-meta"><span>${escapeHtml(project.kind)}</span><span data-project-status="${escapeHtml(project.status.toLowerCase())}">${escapeHtml(project.status)}</span></div>
      <h3>${escapeHtml(project.name)}</h3>
      <p>${escapeHtml(project.description)}</p>
      <div class="project-card-version">Version ${escapeHtml(project.version)}</div>
      <div class="project-card-actions">
        ${project.repository ? `<a class="mc-button" href="${escapeHtml(project.repository)}" target="_blank" rel="noreferrer">Project page</a>` : ''}
        <a class="mc-button primary-button" href="${escapeHtml(project.download)}" download>Download</a>
      </div>
    </article>`).join('');
    const notices = [
      'The official locations landing page still says 15, but its own index and current location pages resolve to 16. This dataset uses the 16 current pages.',
      `${data.validation.locationVaryingRarities.length} species change rarity by location. The app keeps every location association instead of flattening those fish into one rarity.`,
      'Historical event-table entries stay visible behind an availability filter and are excluded from permanent completion by default.',
      'Global rarity-pool and variant odds are published. Ordinary location-pool per-fish probabilities are not; some historical events do publish conditional odds, and the app labels those separately.'
    ];
    byId('quality-notices').innerHTML = notices.map(notice => `<div class="quality-item">${escapeHtml(notice)}</div>`).join('');
  }

  function downloadProgress() {
    const blob = new Blob([root.ProgressStore.exportJson()], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fishonmc-progress-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast('Progress backup exported.');
  }

  function initBackups() {
    byId('export-progress').addEventListener('click', downloadProgress);
    byId('import-progress').addEventListener('change', event => {
      const file = event.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = root.ProgressStore.importJson(String(reader.result));
        if (!result.ok) { showToast(result.error); return; }
        dismissOriginMigration();
        root.dispatchEvent(new CustomEvent('fishon:progress-changed'));
        showToast('Progress backup imported.');
      };
      reader.readAsText(file);
      event.target.value = '';
    });
    const dialog = byId('reset-dialog');
    byId('request-reset').addEventListener('click', () => dialog.showModal());
    byId('confirm-reset').addEventListener('click', event => {
      event.preventDefault();
      root.ProgressStore.reset();
      dialog.close();
      root.dispatchEvent(new CustomEvent('fishon:progress-changed'));
      showToast('All local progress reset.');
    });
  }

  function dismissOriginMigration() {
    const notice = byId('origin-migration-notice');
    if (notice) notice.hidden = true;
    try { localStorage.setItem(MIGRATION_DISMISS_KEY, '1'); } catch { /* Storage may be unavailable in private mode. */ }
  }

  function initOriginMigration() {
    const notice = byId('origin-migration-notice');
    if (!notice || location.protocol === 'file:') return;
    const progress = root.ProgressStore.load();
    const hasProgress = Object.keys(progress.entries || {}).length > 0 || Object.keys(progress.guide?.completedSteps || {}).length > 0;
    let dismissed = false;
    try { dismissed = localStorage.getItem(MIGRATION_DISMISS_KEY) === '1'; } catch { /* Keep the notice visible when storage is unavailable. */ }
    if (hasProgress || dismissed) return;
    const migrationCopy = publicMode
      ? 'If you used an earlier standalone copy, open it, choose <b>Export backup</b>, return here, then choose <b>Import backup</b> in My Progress. Browser security prevents this local Tracker from reading file-mode storage automatically.'
      : 'If you used the old guide, open that original HTML file, choose <b>Export backup</b>, return here, then choose <b>Import backup</b> in My Progress. Browser security prevents this loopback guide from reading file-mode storage automatically.';
    notice.innerHTML = `<div><strong>Move your existing file-mode progress once</strong><p>${migrationCopy}</p></div><button class="mc-button" id="dismiss-origin-migration" type="button">Dismiss</button>`;
    notice.hidden = false;
    byId('dismiss-origin-migration').addEventListener('click', dismissOriginMigration);
  }

  function initEvents() {
    root.addEventListener('fishon:toast', event => showToast(event.detail));
    root.addEventListener('fishon:backdrop-location', event => setBackdrop(event.detail));
    root.addEventListener('fishon:location-selected', event => {
      const location = event.detail;
      setBackdrop(location);
      openTab('compendium');
      root.FishOnCompendium.setLocationFilter(location.id);
    });
    root.addEventListener('fishon:fish-selected', event => {
      openTab('compendium');
      root.FishOnCompendium.openFish(event.detail.fishId, event.detail.locationId);
    });
    root.addEventListener('fishon:open-setup', event => {
      openTab('setups');
      byId('setup-location').value = event.detail.locationId;
      updateSetupFish(event.detail.fishId);
      setBackdrop(data.locations.find(location => location.id === event.detail.locationId));
    });
  }

  function init() {
    byId('header-fish-count').textContent = `${data.fish.length.toLocaleString()} species • ${data.validation.totalLocationRows.toLocaleString()} location entries`;
    byId('snapshot-date').textContent = data.snapshot;
    byId('save-state').textContent = root.ProgressStore.status().persistenceAvailable ? 'Local save ready' : 'Private-mode save unavailable';
    initTabs();
    if (appConfig.hasGuide) root.FishOnGuide?.init?.();
    root.FishOnCatchLog.init();
    root.FishOnCompendium.init();
    root.FishOnLocations.init();
    root.FishOnProgressView.init();
    initSetups();
    initSources();
    root.FishOnDiagnostics.init();
    root.FishOnDashboard.init({ openTab });
    initBackups();
    initOriginMigration();
    initEvents();
    const initialTab = location.hash.slice(1);
    const availableTabs = ['dashboard', ...(appConfig.hasGuide ? ['guide'] : []), 'compendium', 'locations', 'setups', 'progress', 'sources'];
    const defaultTab = location.protocol === 'file:' ? 'compendium' : 'dashboard';
    openTab(availableTabs.includes(initialTab) ? initialTab : defaultTab);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

  root.FishOnApp = { openTab, setBackdrop, showToast };
})(window);
