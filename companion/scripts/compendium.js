(function (root) {
  'use strict';

  const data = root.FISHON_DATA;
  const model = root.FishOnModel;
  const catchStats = root.FishOnCatchStats;
  const completion = root.FishOnCompletionModel;
  if (!data || !model || !catchStats || !completion) return;

  const state = {
    search: '', location: '', water: '', rarity: '', group: '', climate: '', lifestyle: '', availability: '', progress: '',
    sort: 'name', selectedFishId: data.fish.find(fish => fish.name === 'Bluegill')?.id || data.fish[0]?.id || '', selectedLocationId: ''
  };

  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const rarityClass = value => `rarity-${String(value || 'unknown').toLowerCase().replace(/[^a-z]+/g, '-')}`;
  const safeUrl = value => {
    try { const url = new URL(value); return url.protocol === 'https:' ? url.href : '#'; } catch { return '#'; }
  };
  const assetUrl = value => {
    try { return new URL(value, document.baseURI).href; } catch { return ''; }
  };
  const locationById = id => data.locations.find(location => location.id === id);
  const progressSnapshot = () => root.ProgressStore.load();
  let oddsTimer;

  function fillSelect(id, options) {
    const select = byId(id);
    if (!select) return;
    for (const option of options) {
      const element = document.createElement('option');
      element.value = option.value;
      element.textContent = option.label;
      select.appendChild(element);
    }
  }

  function queryState() {
    return {
      search: state.search,
      location: state.location,
      water: state.water,
      rarity: state.rarity,
      group: state.group,
      climate: state.climate,
      lifestyle: state.lifestyle,
      availability: state.availability,
      progress: state.progress
    };
  }

  function currentAssociation(fish) {
    const wanted = state.selectedLocationId || state.location;
    return model.associationFor(fish, wanted);
  }

  function displayFor(fish, field, associationField) {
    const association = currentAssociation(fish);
    if ((state.selectedLocationId || state.location) && association?.[associationField]) return association[associationField];
    return fish[field] || 'Not published';
  }

  function isNormalCaught(fish) {
    const progress = progressSnapshot();
    const associations = state.location ? fish.locations.filter(location => location.locationId === state.location) : fish.locations;
    return associations.some(location => model.getEntry(progress, fish.id, location.locationId)?.normal);
  }

  function renderResults() {
    const progress = progressSnapshot();
    let records = model.filterFish(data.fish, queryState(), progress);
    records = model.sortFish(records, state.sort, progress, state.location);
    byId('result-count').textContent = `${records.length.toLocaleString()} fish`;
    const container = byId('fish-results');
    if (!records.length) {
      container.innerHTML = '<div class="empty-state"><div><strong>No fish match this loadout.</strong><br>Clear one or more filters and try again.</div></div>';
      return;
    }
    container.innerHTML = records.map(fish => {
      const association = state.location ? fish.locations.find(location => location.locationId === state.location) : null;
      const rarity = association?.rarity || fish.rarity;
      const group = association?.group || fish.group;
      const water = association?.water || (fish.waterTypes.length === 1 ? fish.waterTypes[0] : 'Multiple waters');
      const selected = fish.id === state.selectedFishId;
      const caught = isNormalCaught(fish);
      return `<button class="fish-row${selected ? ' is-selected' : ''}" type="button" role="option" aria-selected="${selected}" data-fish-id="${escapeHtml(fish.id)}">
        <span class="fish-row-sprite"><img src="${escapeHtml(fish.image)}" alt="" loading="lazy"></span>
        <span class="fish-row-name"><strong>${escapeHtml(fish.name)}</strong><small>${escapeHtml(group)}</small></span>
        <span class="fish-row-water">${escapeHtml(water)}</span>
        <span class="fish-row-rarity ${rarityClass(rarity)}">${escapeHtml(rarity)}</span>
        <span class="completion-tick${caught ? ' is-done' : ''}" aria-label="${caught ? 'Normal caught' : 'Normal not caught'}">${caught ? '✓' : ''}</span>
      </button>`;
    }).join('');
    container.querySelectorAll('[data-fish-id]').forEach(button => button.addEventListener('click', () => openFish(button.dataset.fishId)));
  }

  function locationRows(fish) {
    return fish.locations.map(location => `<tr>
      <td><button class="text-button" type="button" data-detail-location="${escapeHtml(location.locationId)}">${escapeHtml(location.locationName)}</button>${location.eventOnly ? `<small class="event-note">${escapeHtml(location.eventName || 'Historical event')}</small>` : ''}</td>
      <td>${escapeHtml(model.formatUnlockLevel(location.unlockLevel))}</td><td>${escapeHtml(location.water)}</td><td>${escapeHtml(location.climate)}</td>
      <td class="${rarityClass(location.rarity)}">${escapeHtml(location.rarity)}</td><td>${escapeHtml(location.group || 'Not published')}</td>
      <td>${escapeHtml(location.lifestyle || 'Not published')}</td><td>${escapeHtml(location.ecosystemRole || 'Not published')}</td>
    </tr>`).join('');
  }

  function completionControls(fish, association, entry) {
    const completionState = entry?.completion || completion.blankCompletion();
    const summary = completion.objectives({ completion: completionState }, association.completionAvailability || {});
    const labels = { baby: 'Baby', juvenile: 'Juvenile', adult: 'Adult', large: 'Large', gigantic: 'Gigantic', albino: 'Albino', melanistic: 'Melanistic', trophy: 'Trophy', fabled: 'Fabled' };
    const checkbox = (type, key, checked, attainable, label) => attainable
      ? `<label class="completion-check"><input type="checkbox" data-completion-${type}="${escapeHtml(key)}"${checked ? ' checked' : ''}><span>${escapeHtml(label)}</span></label>`
      : `<span class="completion-check is-na" aria-label="${escapeHtml(label)} unavailable"><span>${escapeHtml(label)}</span><strong>N/A</strong></span>`;
    const sizes = completion.sizes.map(size => checkbox('size', size, completionState.sizes[size], summary.sizes.items[size].attainable, labels[size])).join('');
    const variants = completion.variants.map(variant => checkbox('variant', variant, completionState.variants[variant], summary.variants.items[variant].attainable, labels[variant])).join('');
    const header = completion.variants.map(variant => `<th scope="col">${escapeHtml(labels[variant])}</th>`).join('');
    const rows = completion.sizes.map(size => `<tr><th scope="row">${escapeHtml(labels[size])}</th>${completion.variants.map(variant => {
      const key = completion.combinationKey(size, variant);
      const item = summary.combinations.items[key];
      return `<td>${item.attainable ? `<label class="matrix-check"><input type="checkbox" data-completion-combination="${escapeHtml(key)}" aria-label="${escapeHtml(`${labels[size]} ${labels[variant]} caught`)}"${completionState.combinations[key] ? ' checked' : ''}><span aria-hidden="true"></span></label>` : '<span class="matrix-na">N/A</span>'}</td>`;
    }).join('')}</tr>`).join('');
    return `<div class="everything-summary"><strong>${summary.done} / ${summary.total}</strong><span>Everything completion</span></div>
      <div class="primary-completion-groups">
        <fieldset class="completion-group"><legend>Caught</legend>${checkbox('caught', 'caught', completionState.caught, summary.caught.attainable, 'Caught')}</fieldset>
        <fieldset class="completion-group"><legend>Sizes · ${summary.sizes.done}/${summary.sizes.total}</legend><div class="completion-checks">${sizes}</div></fieldset>
        <fieldset class="completion-group"><legend>Variants · ${summary.variants.done}/${summary.variants.total}</legend><div class="completion-checks">${variants}</div></fieldset>
      </div>
      <details class="combination-tracker"><summary>
        <span class="combination-summary-label"><span class="combination-chevron" aria-hidden="true">›</span><span><strong>Variant combinations</strong><small class="combination-closed-copy">Show all ${summary.combinations.total} size × variant checkboxes</small><small class="combination-open-copy">Hide size × variant checkboxes</small></span></span>
        <strong class="combination-progress">${summary.combinations.done} / ${summary.combinations.total}</strong>
      </summary>
        <div class="combination-table-scroll" tabindex="0"><table class="combination-table"><caption>Exact size and variant combinations</caption><thead><tr><th scope="col">Size</th>${header}</tr></thead><tbody>${rows}</tbody></table></div>
      </details>`;
  }

  function baitMarkup(fish, association) {
    const matches = root.FishOnSetups.rankBaits(data, fish, association).slice(0, 10);
    if (!matches.length) return '<p class="notice info">No direct published bait/group/water match was parsed. Use the live tacklebox tooltip and broad bait rather than assuming an exact favorite.</p>';
    return matches.map(({ bait, evidence }) => `<div class="bait-match">
      ${bait.image ? `<img src="${escapeHtml(bait.image)}" alt="" loading="lazy">` : '<span class="sprite-slot">?</span>'}
      <div><strong>${escapeHtml(bait.name)}</strong><small>${escapeHtml(bait.effects.join(' • '))}</small>${bait.dataQuality.length ? `<small class="data-warning">${escapeHtml(bait.dataQuality.join(' • '))}</small>` : ''}</div>
      <span class="evidence-label">${escapeHtml(evidence)}</span>
    </div>`).join('');
  }

  function setupMarkup(fish, association) {
    return root.FishOnSetups.forFish(data, fish, association.locationId, 'normal').map(item => `<li><strong>${escapeHtml(item.title)}</strong><br>${escapeHtml(item.text)}<small class="recommendation-source">${escapeHtml(item.source)}</small></li>`).join('');
  }

  function renderDetail() {
    const fish = data.fish.find(item => item.id === state.selectedFishId) || data.fish[0];
    if (!fish) return;
    const association = currentAssociation(fish);
    if (!association) return;
    state.selectedLocationId = association.locationId;
    const entry = root.ProgressStore.get(fish.id, association.locationId);
    const loggedStats = catchStats.entryStats(entry || {}, fish);
    const rarityChance = data.odds.rarity[association.rarity];
    const locationMeta = locationById(association.locationId);
    const historicalOdds = association.eventOnly ? fish.eventOdds : null;
    const eventNotice = association.eventOnly ? `<p class="notice"><strong>Historical/event-only:</strong> ${escapeHtml(association.eventName || 'This fish is not currently obtainable outside its event.')}${historicalOdds ? ` Official historical condition: <strong>1 / ${historicalOdds.denominator.toLocaleString()}</strong> — ${escapeHtml(historicalOdds.condition)}.` : ''}</p>` : '';
    const varyingNotice = fish.rarities.length > 1 || fish.groups.length > 1 ? '<p class="notice info">This species changes rarity or group by location. The selected location row below controls the displayed setup and chance pool.</p>' : '';
    const sizeText = fish.maximumWeightLb || fish.maximumLengthIn
      ? `${fish.maximumWeightLb ? model.formatWeight(fish.maximumWeightLb) : ''}${fish.maximumWeightLb && fish.maximumLengthIn ? ' • ' : ''}${fish.maximumLengthIn ? `${fish.maximumLengthIn.toLocaleString(undefined, { maximumFractionDigits: 2 })} in` : ''}`
      : 'Not published';
    const rarityPoolText = association.rarity === 'Unverified'
      ? 'Awaiting verification'
      : Number.isFinite(rarityChance) ? `${rarityChance}%` : 'Special / not applicable';
    const speciesSource = fish.wikiUrl
      ? `<a href="${safeUrl(fish.wikiUrl)}" target="_blank" rel="noreferrer">Open official species page</a>`
      : '<span>Official species page pending</span>';
    const locationOptions = fish.locations.map(location => `<option value="${escapeHtml(location.locationId)}" ${location.locationId === association.locationId ? 'selected' : ''}>${escapeHtml(location.locationName)}${location.eventOnly ? ' — event' : ''}</option>`).join('');
    const detail = byId('fish-detail');
    detail.innerHTML = `<div class="detail-hero" style="--detail-bg:url('${escapeHtml(assetUrl(locationMeta?.image || ''))}')">
      <div class="detail-sprite-wrap"><img src="${escapeHtml(fish.image)}" alt="${escapeHtml(fish.name)} Rustic Fantasy FishOnMC sprite"></div>
      <div class="detail-summary"><h1>${escapeHtml(fish.name)}</h1><p class="scientific-name">${escapeHtml(fish.scientificName || 'Scientific name not published')}</p>
        <div class="fact-grid">
          <div class="fact"><span>Selected location</span><select class="mc-select" id="detail-location-select">${locationOptions}</select></div>
          <div class="fact"><span>Rarity</span><strong class="${rarityClass(association.rarity)}">${escapeHtml(association.rarity)}</strong></div>
          <div class="fact"><span>Global rarity pool</span><strong>${escapeHtml(rarityPoolText)}</strong></div>
          <div class="fact"><span>${historicalOdds ? 'Historical event odds' : 'Ordinary per-fish odds'}</span><strong>${historicalOdds ? `1 / ${historicalOdds.denominator.toLocaleString()} conditional` : 'Not published'}</strong></div>
          <div class="fact"><span>Water / climate</span><strong>${escapeHtml(association.water)} • ${escapeHtml(association.climate)}</strong></div>
          <div class="fact"><span>Group / lifestyle</span><strong>${escapeHtml(association.group || '—')} • ${escapeHtml(association.lifestyle || '—')}</strong></div>
          <div class="fact"><span>Published maximum</span><strong>${escapeHtml(sizeText)}</strong></div>
          <div class="fact"><span>Ecosystem role</span><strong>${escapeHtml(association.ecosystemRole || 'Not published')}</strong></div>
        </div>
      </div>
    </div>
    <div class="detail-body">
      ${eventNotice}${varyingNotice}
      <section class="detail-section"><h2>About this fish</h2><p>${escapeHtml(fish.description || 'The individual wiki page does not publish a description.')}</p></section>
      <section class="detail-section"><h2>Locations and location-specific identity</h2><div class="table-scroll"><table class="location-table"><thead><tr><th>Location</th><th>Unlock</th><th>Water</th><th>Climate</th><th>Rarity</th><th>Group</th><th>Lifestyle</th><th>Role</th></tr></thead><tbody>${locationRows(fish)}</tbody></table></div></section>
      <section class="detail-section"><h2>My completion — ${escapeHtml(association.locationName)}</h2><div class="everything-compendium">${completionControls(fish, association, entry)}</div>
        <div class="compendium-catch-summary"><div><span>Logged catches</span><strong>${loggedStats.count.toLocaleString()}</strong></div><div><span>Minimum</span><strong>${loggedStats.minWeightLb == null ? '—' : `${loggedStats.minWeightLb.toLocaleString()} lb`}</strong></div><div><span>Mean</span><strong>${loggedStats.meanWeightLb == null ? '—' : `${loggedStats.meanWeightLb.toLocaleString()} lb`}</strong></div><div><span>Median</span><strong>${loggedStats.medianWeightLb == null ? '—' : `${loggedStats.medianWeightLb.toLocaleString()} lb`}</strong></div><div><span>Personal best</span><strong>${loggedStats.personalMaxWeightLb == null ? '—' : `${loggedStats.personalMaxWeightLb.toLocaleString()} lb`}</strong></div><div><span>Published max</span><strong>${loggedStats.publishedMaxPercent == null ? '—' : `${loggedStats.publishedMaxPercent.toLocaleString()}%`}</strong></div></div>
        <div class="compendium-catch-actions"><button class="mc-button" id="log-detail-catch" type="button">＋ Log a catch</button><button class="mc-button" id="open-detail-history" type="button">Open catch history (${loggedStats.count})</button></div>
        <div class="progress-fields"><label>Legacy / unlogged PB weight (lb)<input class="mc-number" id="pb-weight" type="number" min="0" step="0.01" value="${entry?.bestWeightLb ?? ''}"></label><label>Legacy / unlogged PB length (in)<input class="mc-number" id="pb-length" type="number" min="0" step="0.01" value="${entry?.bestLengthIn ?? ''}"></label><span class="notice info">Use these only for old records that do not have an individual catch row. Logged catches calculate their own PB automatically.</span></div>
        <label class="notes-field">Notes<textarea id="fish-notes" maxlength="2000" placeholder="Bait used, contest result, record attempt…">${escapeHtml(entry?.notes || '')}</textarea></label>
      </section>
      <section class="detail-section"><h2>Variant odds calculator</h2><div class="detail-grid"><div class="inventory-box"><h3>Chance bonus</h3><label>Variant Chance bonus %<input class="mc-number" id="variant-bonus" type="number" min="0" step="1" value="0"></label><p class="notice info">Expected independent-trial odds, never a guarantee. Fabled exists only during its event and ends after one server-wide catch.</p></div><div class="inventory-box"><h3>Effective denominators</h3><div id="effective-odds"></div></div></div></section>
      <section class="detail-section"><h2>Relevant official bait &amp; lure effects</h2><p class="notice info">Ranked by explicit species/group/location/water match. Package source locations are not treated as targeting effects.</p>${baitMarkup(fish, association)}</section>
      <section class="detail-section"><h2>Recommended normal-compendium setup</h2><ul class="setup-list">${setupMarkup(fish, association)}</ul><p><button class="mc-button" type="button" id="open-setup-builder">Open full setup builder</button></p></section>
      <section class="detail-section"><h2>Source and data quality</h2><p>${speciesSource} • Source checked: ${escapeHtml(fish.sourceUpdated ? fish.sourceUpdated.slice(0, 10) : 'Not published')} • Snapshot: ${escapeHtml(data.snapshot)}</p>${fish.dataQuality.length ? `<ul>${fish.dataQuality.map(note => `<li>${escapeHtml(note)}</li>`).join('')}</ul>` : '<p>No field-level warnings for this species.</p>'}</section>
    </div>`;

    bindDetail(fish, association);
    updateEffectiveOdds(0);
  }

  function updateEffectiveOdds(bonus) {
    const container = byId('effective-odds');
    if (!container) return;
    container.innerHTML = Object.entries(data.odds.variants).map(([name, values]) => {
      const effective = model.calculateVariantOdds(values.denominator, bonus);
      return `<div class="fact"><span>${escapeHtml(name)}<small>${escapeHtml(values.availability)}</small></span><strong>1 / ${Math.round(effective).toLocaleString()}</strong></div>`;
    }).join('');
  }

  function bindDetail(fish, association) {
    byId('detail-location-select')?.addEventListener('change', event => { state.selectedLocationId = event.target.value; renderDetail(); renderResults(); });
    document.querySelectorAll('[data-detail-location]').forEach(button => button.addEventListener('click', () => { state.selectedLocationId = button.dataset.detailLocation; renderDetail(); renderResults(); }));
    document.querySelectorAll('[data-progress-field]').forEach(input => input.addEventListener('change', () => {
      root.ProgressStore.updateFish(fish.id, association.locationId, { [input.dataset.progressField]: input.checked });
      progressChanged();
    }));
    document.querySelectorAll('[data-completion-caught]').forEach(input => input.addEventListener('change', () => { root.ProgressStore.updateCompletion(fish.id, association.locationId, { caught: input.checked }); progressChanged(); }));
    document.querySelectorAll('[data-completion-size]').forEach(input => input.addEventListener('change', () => { root.ProgressStore.updateCompletion(fish.id, association.locationId, { sizes: { [input.dataset.completionSize]: input.checked } }); progressChanged(); }));
    document.querySelectorAll('[data-completion-variant]').forEach(input => input.addEventListener('change', () => { root.ProgressStore.updateCompletion(fish.id, association.locationId, { variants: { [input.dataset.completionVariant]: input.checked } }); progressChanged(); }));
    document.querySelectorAll('[data-completion-combination]').forEach(input => input.addEventListener('change', () => { root.ProgressStore.updateCompletion(fish.id, association.locationId, { combinations: { [input.dataset.completionCombination]: input.checked } }); progressChanged(); }));
    const persistText = () => {
      root.ProgressStore.updateFish(fish.id, association.locationId, {
        bestWeightLb: byId('pb-weight')?.value ?? '', bestLengthIn: byId('pb-length')?.value ?? '', notes: byId('fish-notes')?.value ?? ''
      });
      progressChanged(false);
    };
    byId('pb-weight')?.addEventListener('change', persistText);
    byId('pb-length')?.addEventListener('change', persistText);
    byId('fish-notes')?.addEventListener('change', persistText);
    byId('variant-bonus')?.addEventListener('input', event => {
      clearTimeout(oddsTimer);
      oddsTimer = setTimeout(() => updateEffectiveOdds(Number(event.target.value || 0)), 80);
    });
    byId('open-setup-builder')?.addEventListener('click', () => root.dispatchEvent(new CustomEvent('fishon:open-setup', { detail: { fishId: fish.id, locationId: association.locationId } })));
    byId('log-detail-catch')?.addEventListener('click', event => root.FishOnCatchLog.open({ fishId: fish.id, locationId: association.locationId, returnFocus: event.currentTarget }));
    byId('open-detail-history')?.addEventListener('click', event => root.FishOnCatchLog.open({ fishId: fish.id, locationId: association.locationId, returnFocus: event.currentTarget }));
  }

  function progressChanged(showToast = true) {
    renderResults();
    root.dispatchEvent(new CustomEvent('fishon:progress-changed'));
    if (showToast) root.dispatchEvent(new CustomEvent('fishon:toast', { detail: 'Progress saved locally.' }));
  }

  function openFish(fishId, locationId = '') {
    if (!data.fish.some(fish => fish.id === fishId)) return;
    state.selectedFishId = fishId;
    state.selectedLocationId = locationId || state.location || '';
    renderResults();
    renderDetail();
  }

  function setLocationFilter(locationId) {
    state.location = locationId || '';
    state.selectedLocationId = locationId || '';
    byId('filter-location').value = state.location;
    const backdropLocation = locationById(state.location);
    if (backdropLocation) root.dispatchEvent(new CustomEvent('fishon:backdrop-location', { detail: backdropLocation }));
    renderResults();
    const first = model.sortFish(model.filterFish(data.fish, queryState(), progressSnapshot()), state.sort, progressSnapshot(), state.location)[0];
    if (first) openFish(first.id, locationId);
    else byId('fish-detail').innerHTML = '<div class="empty-state"><div><strong>No fish match every active filter.</strong><br>The old fish detail was cleared so it cannot be mistaken for a result.</div></div>';
  }

  function resetFilters() {
    for (const key of ['search', 'location', 'water', 'rarity', 'group', 'climate', 'lifestyle', 'availability', 'progress']) state[key] = '';
    state.selectedLocationId = '';
    for (const id of ['fish-search', 'filter-location', 'filter-water', 'filter-rarity', 'filter-group', 'filter-climate', 'filter-lifestyle', 'filter-availability', 'filter-progress']) byId(id).value = '';
    renderResults(); renderDetail();
  }

  function init() {
    fillSelect('filter-location', model.options(data, 'location'));
    fillSelect('filter-water', model.options(data, 'water'));
    fillSelect('filter-rarity', model.options(data, 'rarity'));
    fillSelect('filter-group', model.options(data, 'group'));
    fillSelect('filter-climate', model.options(data, 'climate'));
    fillSelect('filter-lifestyle', model.options(data, 'lifestyle'));
    const bindings = {
      'fish-search': ['search', 'input'], 'filter-location': ['location', 'change'], 'filter-water': ['water', 'change'], 'filter-rarity': ['rarity', 'change'],
      'filter-group': ['group', 'change'], 'filter-climate': ['climate', 'change'], 'filter-lifestyle': ['lifestyle', 'change'], 'filter-availability': ['availability', 'change'],
      'filter-progress': ['progress', 'change'], 'sort-fish': ['sort', 'change']
    };
    for (const [id, [key, eventName]] of Object.entries(bindings)) byId(id).addEventListener(eventName, event => {
      state[key] = event.target.value;
      if (key === 'location') { setLocationFilter(event.target.value); return; }
      renderResults();
    });
    byId('reset-filters').addEventListener('click', resetFilters);
    root.addEventListener('fishon:progress-changed', () => { renderResults(); renderDetail(); });
    renderResults(); renderDetail();
  }

  root.FishOnCompendium = { init, renderResults, renderDetail, openFish, setLocationFilter, state };
})(window);
