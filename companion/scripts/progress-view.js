(function (root) {
  'use strict';

  const data = root.FISHON_DATA;
  const model = root.FishOnModel;
  const catchStats = root.FishOnCatchStats;
  const completion = root.FishOnCompletionModel;
  if (!data || !model || !catchStats || !completion) return;

  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const variantLabels = { normal: 'Normal', gigantic: 'Gigantic', albino: 'Albino', melanistic: 'Melanistic', trophy: 'Trophy', fabled: 'Fabled' };
  let includeEvents = false;

  function rows() {
    return catchStats.associationRows(data, root.ProgressStore.load(), includeEvents);
  }

  function summarize(records, field) {
    const done = records.filter(record => record.entry?.[field]).length;
    return { done, total: records.length, percent: model.percentage(done, records.length) };
  }

  function progressCell(summary) {
    return `<div class="cell-progress"><strong>${summary.percent.toFixed(0)}%</strong><small>${summary.done}/${summary.total}</small></div>`;
  }

  function formatNumber(value, suffix = '') {
    return value == null ? '—' : `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 })}${suffix}`;
  }

  function populateFilters() {
    const option = (value, label) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
    byId('catch-filter-location').insertAdjacentHTML('beforeend', data.locations.map(location => option(location.id, location.name)).join(''));
    const associations = data.fish.flatMap(fish => fish.locations || []);
    const waters = [...new Set(associations.map(item => item.water).filter(Boolean))].sort();
    const rarities = [...new Set(associations.map(item => item.rarity).filter(Boolean))].sort((a, b) => (model.rarityRank[b] ?? -1) - (model.rarityRank[a] ?? -1));
    byId('catch-filter-water').insertAdjacentHTML('beforeend', waters.map(value => option(value, value)).join(''));
    byId('catch-filter-rarity').insertAdjacentHTML('beforeend', rarities.map(value => option(value, value)).join(''));
  }

  function renderLocationTable(records) {
    byId('location-progress-body').innerHTML = data.locations.map(location => {
      const locationRows = records.filter(record => record.association.locationId === location.id);
      return `<tr><td><button class="text-button" type="button" data-progress-location="${escapeHtml(location.id)}">${escapeHtml(location.name)}</button><small>${escapeHtml(model.formatUnlockLevel(location.unlockLevel))}</small></td>${model.completionFields.map(field => `<td>${progressCell(summarize(locationRows, field))}</td>`).join('')}</tr>`;
    }).join('');
  }

  function renderBreakdown(records) {
    byId('variant-breakdown').innerHTML = model.completionFields.map(field => {
      const summary = summarize(records, field);
      return `<div class="breakdown-row"><span>${variantLabels[field]}</span><span class="mini-track"><span style="width:${summary.percent.toFixed(2)}%"></span></span><strong>${summary.done}/${summary.total}</strong></div>`;
    }).join('');
  }

  function renderRareMissing(records) {
    const missing = records
      .filter(record => ['Legendary', 'Mythical'].includes(record.association.rarity) && !record.entry?.normal)
      .sort((a, b) => model.rarityRank[b.association.rarity] - model.rarityRank[a.association.rarity] || a.fish.name.localeCompare(b.fish.name))
      .slice(0, 18);
    byId('rare-missing').innerHTML = missing.length ? missing.map(record => `<div class="mini-item"><button type="button" data-progress-fish="${escapeHtml(record.fish.id)}" data-progress-fish-location="${escapeHtml(record.association.locationId)}"><strong>${escapeHtml(record.fish.name)}</strong><br><small>${escapeHtml(record.association.locationName)}</small></button><span class="rarity-${record.association.rarity.toLowerCase()}">${escapeHtml(record.association.rarity)}</span></div>`).join('') : '<p class="notice info">Every visible Legendary and Mythical entry is marked caught.</p>';
  }

  function renderRecent(records) {
    const recent = records.filter(record => record.entry?.updatedAt && new Date(record.entry.updatedAt).getTime() > 0)
      .sort((a, b) => String(b.entry.updatedAt).localeCompare(String(a.entry.updatedAt))).slice(0, 14);
    byId('recent-progress').innerHTML = recent.length ? recent.map(record => `<div class="mini-item"><button type="button" data-progress-fish="${escapeHtml(record.fish.id)}" data-progress-fish-location="${escapeHtml(record.association.locationId)}"><strong>${escapeHtml(record.fish.name)}</strong><br><small>${escapeHtml(record.association.locationName)}</small></button><small>${new Date(record.entry.updatedAt).toLocaleDateString()}</small></div>`).join('') : '<p>No catches saved yet. Start in My Catches or the compendium.</p>';
  }

  function filterQuery() {
    return {
      search: byId('catch-search').value,
      location: byId('catch-filter-location').value,
      water: byId('catch-filter-water').value,
      rarity: byId('catch-filter-rarity').value,
      status: byId('catch-filter-status').value,
      variant: byId('catch-filter-variant').value,
      weight: byId('catch-filter-weight').value
    };
  }

  function renderGlobalStats() {
    const global = catchStats.globalStats(data, root.ProgressStore.load(), includeEvents);
    byId('catch-stat-total').textContent = global.totalLoggedCatches.toLocaleString();
    byId('catch-stat-completion').textContent = `${global.completionPercent.toFixed(1)}%`;
    byId('catch-stat-mean').textContent = formatNumber(global.meanWeightLb, ' lb');
    byId('catch-stat-median').textContent = formatNumber(global.medianWeightLb, ' lb');
    byId('catch-stat-heaviest').textContent = global.heaviest ? `${global.heaviest.fishName} · ${formatNumber(global.heaviest.weightLb, ' lb')}` : '—';
    byId('catch-stat-closest').textContent = global.closestToPublished ? `${global.closestToPublished.fishName} · ${formatNumber(global.closestToPublished.percent, '%')}` : '—';
    byId('catch-stat-completeness').textContent = global.completeness.score == null ? '—' : `${global.completeness.score.toFixed(0)}%`;
    const highlights = [];
    if (global.mostCompleteLocation) highlights.push(`<span class="catch-highlight">Best-covered location: <strong>${escapeHtml(global.mostCompleteLocation.name)} ${formatNumber(global.mostCompleteLocation.percent, '%')}</strong></span>`);
    if (global.widestRange) highlights.push(`<span class="catch-highlight">Widest logged spread: <strong>${escapeHtml(global.widestRange.fish.name)} ${formatNumber(global.widestRange.stats.weightRangeLb, ' lb')}</strong></span>`);
    if (global.topBaits[0]) highlights.push(`<span class="catch-highlight">Most logged bait: <strong>${escapeHtml(data.baits.find(bait => bait.id === global.topBaits[0].key)?.name || global.topBaits[0].key)} · n=${global.topBaits[0].sampleCount}</strong></span>`);
    if (global.topSessions[0]) highlights.push(`<span class="catch-highlight">Largest session: <strong>${escapeHtml(global.topSessions[0].key)} · n=${global.topSessions[0].sampleCount}</strong></span>`);
    if (!global.totalLoggedCatches) highlights.push('<span class="catch-highlight">Log individual catches to unlock weight, reward, setup, session, and record analytics.</span>');
    byId('catch-highlights').innerHTML = highlights.join('');
    renderAnalytics(global);
  }

  function renderAnalytics(global) {
    const row = (label, value) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`;
    const card = (title, content) => `<section class="catch-analysis-card"><h3>${escapeHtml(title)}</h3><dl>${content}</dl></section>`;
    const percent = (count, total = global.totalLoggedCatches) => total ? `${count.toLocaleString()} · ${((count / total) * 100).toFixed(0)}%` : '0';
    const leader = (records, formatter = value => value) => {
      const best = records?.[0];
      if (!best) return '—';
      const name = formatter(best.key);
      return `${name} · n=${best.sampleCount}${best.meanWeightLb == null ? '' : ` · avg ${formatNumber(best.meanWeightLb, ' lb')}`}`;
    };
    const baitName = key => data.baits.find(bait => bait.id === key)?.name || key;
    const variantRows = catchStats.variants.map(variant => row(variantLabels[variant], global.variantTotals[variant].toLocaleString())).join('');
    const sizeLabels = { baby: 'Baby', juvenile: 'Juvenile', adult: 'Adult', large: 'Large', gigantic: 'Gigantic' };
    const sizeRows = Object.entries(global.sizeTierTotals).map(([tier, count]) => row(sizeLabels[tier] || tier, count.toLocaleString())).join('');
    const start = global.firstCaughtAt ? new Date(global.firstCaughtAt).toLocaleDateString() : '—';
    const latest = global.latestCaughtAt ? new Date(global.latestCaughtAt).toLocaleDateString() : '—';
    byId('catch-analytics-grid').innerHTML = [
      card('Weight distribution', row('Recorded', percent(global.weightCount)) + row('Total weight', formatNumber(global.totalWeightLb, ' lb')) + row('Minimum', formatNumber(global.minWeightLb, ' lb')) + row('Mean / average', formatNumber(global.meanWeightLb, ' lb')) + row('Median', formatNumber(global.medianWeightLb, ' lb')) + row('Maximum', formatNumber(global.maxWeightLb, ' lb'))),
      card('Length distribution', row('Recorded', percent(global.lengthCount)) + row('Minimum', formatNumber(global.minLengthIn, ' in')) + row('Mean / average', formatNumber(global.meanLengthIn, ' in')) + row('Median', formatNumber(global.medianLengthIn, ' in')) + row('Maximum', formatNumber(global.maxLengthIn, ' in'))),
      card('Rewards & fights', row('Total coins', formatNumber(global.totalCoins)) + row('Mean coins', formatNumber(global.meanCoins)) + row('Total XP', formatNumber(global.totalXp)) + row('Mean XP', formatNumber(global.meanXp)) + row('Mean fight', formatNumber(global.meanFightSeconds, ' sec')) + row('Weight / fight sec', formatNumber(global.weightPerFightSecond, ' lb'))),
      card('Variant mix', variantRows),
      card('Size tiers', sizeRows),
      card('Contexts', row('Event', global.contextTotals.event.toLocaleString()) + row('Tournament', global.contextTotals.tournament.toLocaleString()) + row('Quest', global.contextTotals.quest.toLocaleString()) + row('Dated catches', percent(global.datedCount)) + row('Active days', global.activeDays.toLocaleString()) + row('Catches / active day', formatNumber(global.catchesPerActiveDay))),
      card('Activity window', row('First catch', start) + row('Latest catch', latest) + row('Largest session', leader(global.topSessions)) + row('Top day phase', leader(global.topDayPhases)) + row('Top weather', leader(global.topWeather))),
      card('Tackle leaders', row('Bait / lure', leader(global.topBaits, baitName)) + row('Rod', leader(global.topRods)) + row('Reel', leader(global.topReels)) + row('Line', leader(global.topLines))),
      card('Support leaders', row('Armor', leader(global.topArmor)) + row('Pet', leader(global.topPets)) + row('Data completeness', global.completeness.score == null ? '—' : `${global.completeness.score.toFixed(1)}%`) + row('Fish-location rows', `${global.caughtAssociations}/${global.totalAssociations}`)),
      card('Mean logged bonuses', row('Luck', formatNumber(global.bonusAverages.luckBonus)) + row('Variant', formatNumber(global.bonusAverages.variantBonus)) + row('Scale', formatNumber(global.bonusAverages.scaleBonus)) + row('Bite speed', formatNumber(global.bonusAverages.biteSpeedBonus)) + row('Money', formatNumber(global.bonusAverages.moneyBonus)) + row('Power', formatNumber(global.bonusAverages.power)))
    ].join('');
  }

  function everythingChecklist(row) {
    const state = row.entry?.completion || completion.blankCompletion();
    const sizeLabels = { baby: 'Baby', juvenile: 'Juvenile', adult: 'Adult', large: 'Large', gigantic: 'Gigantic' };
    const sizes = completion.sizes.map(size => `<label><input type="checkbox" data-catch-size="${size}" data-catch-fish="${escapeHtml(row.fish.id)}" data-catch-location="${escapeHtml(row.association.locationId)}"${state.sizes[size] ? ' checked' : ''}><span>${sizeLabels[size]}</span></label>`).join('');
    const variants = completion.variants.map(variant => `<label><input type="checkbox" data-catch-variant="${variant}" data-catch-fish="${escapeHtml(row.fish.id)}" data-catch-location="${escapeHtml(row.association.locationId)}"${state.variants[variant] ? ' checked' : ''}><span>${variantLabels[variant]}</span></label>`).join('');
    return `<div class="catch-checklist-stack"><div class="catch-checklist" aria-label="${escapeHtml(row.fish.name)} sizes">${sizes}</div><div class="catch-checklist" aria-label="${escapeHtml(row.fish.name)} variants">${variants}</div></div>`;
  }

  function renderCatchRows(allRows) {
    const filtered = catchStats.sortRows(catchStats.filterRows(allRows, filterQuery()), byId('catch-sort').value);
    byId('my-catches-count').textContent = `${filtered.length.toLocaleString()} ${filtered.length === 1 ? 'entry' : 'entries'}`;
    if (!filtered.length) {
      byId('my-catches-list').innerHTML = '<div class="my-catches-empty">No fish-location entries match these filters.</div>';
      return;
    }
    byId('my-catches-list').innerHTML = filtered.map(row => { const completionSummary = catchStats.completionStats(row.entry || {}, row.association); return `<article class="my-catches-row">
      <div class="catch-fish-cell"><span class="catch-fish-sprite"><img src="${escapeHtml(row.fish.image)}" alt=""></span><div><button type="button" data-progress-fish="${escapeHtml(row.fish.id)}" data-progress-fish-location="${escapeHtml(row.association.locationId)}">${escapeHtml(row.fish.name)}</button><small>${escapeHtml(row.association.locationName)} · <span class="rarity-${escapeHtml(row.association.rarity.toLowerCase())}">${escapeHtml(row.association.rarity)}</span> · ${escapeHtml(row.association.water || 'Unknown water')}</small></div></div>
      ${everythingChecklist(row)}
      <div class="catch-row-stats">
        <div class="catch-row-stat"><span>Logged</span><strong>${row.stats.count.toLocaleString()}</strong></div>
        <div class="catch-row-stat"><span>Min</span><strong>${formatNumber(row.stats.minWeightLb, ' lb')}</strong></div>
        <div class="catch-row-stat"><span>Mean</span><strong>${formatNumber(row.stats.meanWeightLb, ' lb')}</strong></div>
        <div class="catch-row-stat"><span>Median</span><strong>${formatNumber(row.stats.medianWeightLb, ' lb')}</strong></div>
        <div class="catch-row-stat"><span>PB</span><strong>${formatNumber(row.stats.personalMaxWeightLb, ' lb')}</strong></div>
        <div class="catch-row-stat"><span>Published max</span><strong>${formatNumber(row.stats.publishedMaxPercent, '%')}</strong></div>
        <div class="catch-row-stat"><span>Everything</span><strong>${completionSummary.done}/${completionSummary.total}</strong></div>
        <div class="catch-row-stat"><span>Combinations</span><strong>${completionSummary.combinations.done}/${completionSummary.combinations.total}</strong></div>
      </div>
      <div class="catch-row-actions"><button class="mc-button" type="button" data-log-catch="${escapeHtml(row.fish.id)}" data-log-location="${escapeHtml(row.association.locationId)}">＋ Log catch</button><button class="mc-button" type="button" data-open-history="${escapeHtml(row.fish.id)}" data-history-location="${escapeHtml(row.association.locationId)}">History (${row.stats.count})</button></div>
    </article>`; }).join('');
  }

  function render() {
    const records = rows();
    const normal = summarize(records, 'normal');
    byId('overall-percent').textContent = `${normal.percent.toFixed(1)}%`;
    byId('overall-count').textContent = `${normal.done.toLocaleString()} / ${normal.total.toLocaleString()} fish-location entries`;
    byId('overall-progress-bar').style.width = `${normal.percent.toFixed(2)}%`;
    renderGlobalStats();
    renderCatchRows(records);
    renderLocationTable(records);
    renderBreakdown(records);
    renderRareMissing(records);
    renderRecent(records);
  }

  function handleListChange(event) {
    const size = event.target.closest('[data-catch-size]');
    if (size) {
      root.ProgressStore.updateCompletion(size.dataset.catchFish, size.dataset.catchLocation, { sizes: { [size.dataset.catchSize]: size.checked } });
      root.dispatchEvent(new CustomEvent('fishon:progress-changed'));
      return;
    }
    const variant = event.target.closest('[data-catch-variant]');
    if (variant) {
      root.ProgressStore.updateCompletion(variant.dataset.catchFish, variant.dataset.catchLocation, { variants: { [variant.dataset.catchVariant]: variant.checked } });
      root.dispatchEvent(new CustomEvent('fishon:progress-changed'));
      return;
    }
    const checkbox = event.target.closest('[data-catch-checklist-field]');
    if (!checkbox) return;
    const field = checkbox.dataset.catchChecklistField;
    root.ProgressStore.updateFish(checkbox.dataset.catchFish, checkbox.dataset.catchLocation, { [field]: checkbox.checked });
    root.dispatchEvent(new CustomEvent('fishon:progress-changed'));
    root.dispatchEvent(new CustomEvent('fishon:toast', { detail: `${variantLabels[field]} checklist ${checkbox.checked ? 'completed' : 'cleared'}.` }));
  }

  function handleClick(event) {
    const locationButton = event.target.closest('[data-progress-location]');
    if (locationButton) {
      const location = data.locations.find(item => item.id === locationButton.dataset.progressLocation);
      root.dispatchEvent(new CustomEvent('fishon:location-selected', { detail: location }));
      return;
    }
    const fishButton = event.target.closest('[data-progress-fish]');
    if (fishButton) {
      root.dispatchEvent(new CustomEvent('fishon:fish-selected', { detail: { fishId: fishButton.dataset.progressFish, locationId: fishButton.dataset.progressFishLocation } }));
      return;
    }
    const logButton = event.target.closest('[data-log-catch]');
    if (logButton) {
      root.FishOnCatchLog.open({ fishId: logButton.dataset.logCatch, locationId: logButton.dataset.logLocation, returnFocus: logButton });
      return;
    }
    const historyButton = event.target.closest('[data-open-history]');
    if (historyButton) root.FishOnCatchLog.open({ fishId: historyButton.dataset.openHistory, locationId: historyButton.dataset.historyLocation, returnFocus: historyButton });
  }

  function init() {
    populateFilters();
    byId('include-events').addEventListener('change', event => { includeEvents = event.target.checked; render(); });
    ['catch-search', 'catch-filter-location', 'catch-filter-water', 'catch-filter-rarity', 'catch-filter-status', 'catch-filter-variant', 'catch-filter-weight', 'catch-sort'].forEach(id => {
      byId(id).addEventListener(id === 'catch-search' ? 'input' : 'change', () => renderCatchRows(rows()));
    });
    byId('panel-progress').addEventListener('click', handleClick);
    byId('my-catches-list').addEventListener('change', handleListChange);
    root.addEventListener('fishon:progress-changed', render);
    render();
  }

  root.FishOnProgressView = { init, render, rows, summarize };
})(window);
