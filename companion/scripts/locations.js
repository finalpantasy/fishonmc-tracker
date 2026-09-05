(function (root) {
  'use strict';

  const data = root.FISHON_DATA;
  const model = root.FishOnModel;
  if (!data || !model) return;

  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

  function entriesAt(locationId) {
    return data.fish.flatMap(fish => fish.locations
      .filter(association => association.locationId === locationId)
      .map(association => ({ fish, association })));
  }

  function completionFor(locationId) {
    const snapshot = root.ProgressStore.load();
    const rows = entriesAt(locationId).filter(row => !row.association.eventOnly);
    const caught = rows.filter(row => model.getEntry(snapshot, row.fish.id, locationId)?.normal).length;
    return { caught, total: rows.length, percent: model.percentage(caught, rows.length) };
  }

  function render() {
    const container = document.getElementById('locations-grid');
    document.getElementById('locations-summary').textContent = data.locations.length.toLocaleString();
    container.innerHTML = data.locations.map(location => {
      const rows = entriesAt(location.id);
      const permanent = rows.filter(row => !row.association.eventOnly).length;
      const events = rows.length - permanent;
      const completion = completionFor(location.id);
      return `<article class="location-card">
        <div class="location-card-image" style="background-image:url('${escapeHtml(location.image)}')"></div>
        <div class="location-card-body">
          <h2>${escapeHtml(location.name)}</h2>
          <div class="location-card-facts"><span class="mc-chip">${escapeHtml(model.formatUnlockLevel(location.unlockLevel))}</span><span class="mc-chip">${escapeHtml(location.water)}</span><span class="mc-chip">${escapeHtml(location.climate)}</span><span class="mc-chip">Pet: ${escapeHtml(location.pet)}</span></div>
          <div class="location-card-progress"><span>${completion.caught} / ${completion.total} permanent entries</span><strong>${completion.percent.toFixed(0)}%</strong></div>
          <div class="mini-track" aria-hidden="true"><span style="width:${completion.percent.toFixed(2)}%"></span></div>
          <small>${permanent} permanent fish-location entries${events ? ` • ${events} historical event` : ''}</small>
        </div>
        <button type="button" data-location-card="${escapeHtml(location.id)}" aria-label="Open ${escapeHtml(location.name)} in the compendium"></button>
      </article>`;
    }).join('');
    container.querySelectorAll('[data-location-card]').forEach(button => button.addEventListener('click', () => {
      const location = data.locations.find(item => item.id === button.dataset.locationCard);
      root.dispatchEvent(new CustomEvent('fishon:location-selected', { detail: location }));
    }));
  }

  function init() {
    render();
    root.addEventListener('fishon:progress-changed', render);
  }

  root.FishOnLocations = { init, render, entriesAt };
})(window);
