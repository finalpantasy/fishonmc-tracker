(function (root) {
  'use strict';

  const data = root.FISHON_DATA;
  const store = root.ProgressStore;
  const statsApi = root.FishOnCatchStats;
  if (!data || !store || !statsApi) return;

  const byId = id => document.getElementById(id);
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
  const DRAFT_KEY = 'fishonmc-catch-draft-v1';
  const numberFields = {
    weightLb: 'catch-weight', lengthIn: 'catch-length', valueCoins: 'catch-value', xp: 'catch-xp',
    luckBonus: 'catch-luck', variantBonus: 'catch-variant-bonus', scaleBonus: 'catch-scale',
    biteSpeedBonus: 'catch-bite-speed', moneyBonus: 'catch-money', power: 'catch-power', fightSeconds: 'catch-fight-seconds'
  };
  const textFields = {
    sessionTag: 'catch-session', rod: 'catch-rod', reel: 'catch-reel', line: 'catch-line', armor: 'catch-armor', pet: 'catch-pet', notes: 'catch-notes'
  };
  const state = { fish: null, association: null, editingId: null, returnFocus: null, deleteId: null, initialized: false };

  function emit(message) {
    root.dispatchEvent(new CustomEvent('fishon:progress-changed'));
    root.dispatchEvent(new CustomEvent('fishon:toast', { detail: message }));
  }

  function formatNumber(value, suffix = '') {
    return value == null ? '—' : `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 3 })}${suffix}`;
  }

  function formatDate(value) {
    if (!value || !Number.isFinite(Date.parse(value))) return 'Time not recorded';
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  }

  function toLocalInput(value) {
    const date = value && Number.isFinite(Date.parse(value)) ? new Date(value) : new Date();
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function fromLocalInput(value) {
    if (!value) return null;
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  }

  function loadDraft() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch { return {}; }
  }

  function saveDraft(record) {
    const reusable = {
      sessionTag: record.sessionTag, baitId: record.baitId, rod: record.rod, reel: record.reel, line: record.line,
      armor: record.armor, pet: record.pet, luckBonus: record.luckBonus, variantBonus: record.variantBonus,
      scaleBonus: record.scaleBonus, biteSpeedBonus: record.biteSpeedBonus, moneyBonus: record.moneyBonus,
      power: record.power, dayPhase: record.dayPhase, weather: record.weather
    };
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(reusable)); } catch { /* Catch history still saves through the progress store. */ }
  }

  function baitOptions(selected = '') {
    const options = [...data.baits].sort((a, b) => a.name.localeCompare(b.name));
    byId('catch-bait').innerHTML = `<option value="">Not recorded</option>${options.map(bait => `<option value="${escapeHtml(bait.id)}"${bait.id === selected ? ' selected' : ''}>${escapeHtml(bait.name)} · ${escapeHtml(bait.kind)}</option>`).join('')}`;
  }

  function setValue(id, value) {
    const element = byId(id);
    if (element) element.value = value ?? '';
  }

  function fillForm(record = {}) {
    byId('catch-form').reset();
    byId('catch-form-error').hidden = true;
    byId('catch-form-error').textContent = '';
    document.querySelectorAll('#catch-form [aria-invalid="true"]').forEach(element => element.removeAttribute('aria-invalid'));
    setValue('catch-id', record.id || '');
    setValue('catch-caught-at', toLocalInput(record.caughtAt));
    setValue('catch-variant', record.variant || 'normal');
    setValue('catch-size-tier', record.sizeTier || '');
    for (const [field, id] of Object.entries(numberFields)) setValue(id, record[field]);
    for (const [field, id] of Object.entries(textFields)) setValue(id, record[field]);
    baitOptions(record.baitId || '');
    setValue('catch-day-phase', record.dayPhase || '');
    setValue('catch-weather', record.weather || '');
    byId('catch-event').checked = Boolean(record.eventCatch);
    byId('catch-tournament').checked = Boolean(record.tournamentCatch);
    byId('catch-quest').checked = Boolean(record.questCatch);
    const hasAdvanced = ['rod', 'reel', 'line', 'armor', 'pet', 'dayPhase', 'weather'].some(field => record[field])
      || ['luckBonus', 'variantBonus', 'scaleBonus', 'biteSpeedBonus', 'moneyBonus', 'power', 'fightSeconds'].some(field => record[field] != null)
      || record.eventCatch || record.tournamentCatch || record.questCatch;
    byId('catch-advanced').open = Boolean(record.id && hasAdvanced);
  }

  function currentEntry() {
    return state.fish && state.association ? store.get(state.fish.id, state.association.locationId) : null;
  }

  function renderHistory() {
    const entry = currentEntry() || { catches: [] };
    const catches = [...(entry.catches || [])].sort((a, b) => String(b.caughtAt || b.createdAt).localeCompare(String(a.caughtAt || a.createdAt)));
    const summary = statsApi.entryStats(entry, state.fish || {});
    byId('catch-history-count').textContent = catches.length.toLocaleString();
    byId('catch-history-summary').innerHTML = [
      ['Min weight', formatNumber(summary.minWeightLb, ' lb')],
      ['Mean weight', formatNumber(summary.meanWeightLb, ' lb')],
      ['Median weight', formatNumber(summary.medianWeightLb, ' lb')],
      ['Best weight', formatNumber(summary.personalMaxWeightLb, ' lb')]
    ].map(([label, value]) => `<div class="catch-history-stat"><span>${label}</span><strong>${value}</strong></div>`).join('');
    if (!catches.length) {
      byId('catch-history').innerHTML = '<div class="catch-empty">No individual catches logged here yet. Your first catch will also check off its variant.</div>';
      return;
    }
    byId('catch-history').innerHTML = catches.map(record => {
      const bait = data.baits.find(item => item.id === record.baitId)?.name || record.baitText || '';
      const detail = [record.weightLb != null ? `${formatNumber(record.weightLb)} lb` : '', record.lengthIn != null ? `${formatNumber(record.lengthIn)} in` : '', bait].filter(Boolean).join(' · ') || 'No measurements recorded';
      const confirming = state.deleteId === record.id;
      return `<article class="catch-history-item${state.editingId === record.id ? ' is-editing' : ''}">
        <header><h4>${escapeHtml(record.variant)}${record.sizeTier ? ` · ${escapeHtml(record.sizeTier)}` : ''}</h4><small>${escapeHtml(formatDate(record.caughtAt))}</small></header>
        <p>${escapeHtml(detail)}</p>
        <footer><small>${escapeHtml(record.sessionTag || record.notes || '')}</small><span class="catch-history-actions"><button class="mc-button" type="button" data-edit-catch="${escapeHtml(record.id)}">Edit</button><button class="mc-button danger-button" type="button" data-delete-catch="${escapeHtml(record.id)}">${confirming ? 'Confirm delete' : 'Delete'}</button></span></footer>
      </article>`;
    }).join('');
  }

  function beginNew() {
    state.editingId = null;
    state.deleteId = null;
    fillForm({ ...loadDraft(), caughtAt: new Date().toISOString(), variant: 'normal' });
    byId('catch-dialog-title').textContent = 'Log a catch';
    byId('save-catch').textContent = 'Save catch';
    renderHistory();
    byId('catch-weight').focus();
  }

  function editCatch(catchId) {
    const record = currentEntry()?.catches?.find(item => item.id === catchId);
    if (!record) return;
    state.editingId = catchId;
    state.deleteId = null;
    fillForm(record);
    byId('catch-dialog-title').textContent = 'Edit catch';
    byId('save-catch').textContent = 'Update catch';
    renderHistory();
    byId('catch-weight').focus();
  }

  function open({ fishId, locationId, catchId = null, returnFocus = null } = {}) {
    const fish = data.fish.find(item => item.id === fishId);
    const association = fish?.locations?.find(item => item.locationId === locationId);
    if (!fish || !association) {
      root.dispatchEvent(new CustomEvent('fishon:toast', { detail: 'That fish-location entry is no longer available.' }));
      return false;
    }
    state.fish = fish;
    state.association = association;
    state.returnFocus = returnFocus || document.activeElement;
    state.editingId = null;
    state.deleteId = null;
    byId('catch-dialog-context').textContent = `${fish.name} · ${association.locationName} · ${association.rarity}`;
    if (!byId('catch-dialog').open) byId('catch-dialog').showModal();
    if (catchId) editCatch(catchId); else beginNew();
    return true;
  }

  function close() {
    const dialog = byId('catch-dialog');
    if (dialog.open) dialog.close();
  }

  function optionalNumber(id) {
    const input = byId(id);
    if (input.value === '') return null;
    const value = Number(input.value);
    if (!Number.isFinite(value) || value < 0) {
      input.setAttribute('aria-invalid', 'true');
      throw new TypeError(`${input.closest('label')?.firstChild?.textContent?.trim() || 'Number'} must be zero or greater.`);
    }
    input.removeAttribute('aria-invalid');
    return value;
  }

  function readForm() {
    const caughtAt = fromLocalInput(byId('catch-caught-at').value);
    if (byId('catch-caught-at').value && !caughtAt) throw new TypeError('Caught at must be a valid date and time.');
    const record = {
      caughtAt,
      variant: byId('catch-variant').value,
      sizeTier: byId('catch-size-tier').value || null,
      baitId: byId('catch-bait').value,
      baitText: '',
      dayPhase: byId('catch-day-phase').value || null,
      weather: byId('catch-weather').value || null,
      eventCatch: byId('catch-event').checked,
      tournamentCatch: byId('catch-tournament').checked,
      questCatch: byId('catch-quest').checked,
      source: 'manual'
    };
    for (const [field, id] of Object.entries(numberFields)) record[field] = optionalNumber(id);
    for (const [field, id] of Object.entries(textFields)) record[field] = byId(id).value.trim();
    return record;
  }

  function handleSubmit(event) {
    event.preventDefault();
    try {
      const record = readForm();
      if (state.editingId) store.updateCatch(state.fish.id, state.association.locationId, state.editingId, record);
      else store.addCatch(state.fish.id, state.association.locationId, record);
      saveDraft(record);
      const wasEditing = Boolean(state.editingId);
      beginNew();
      emit(wasEditing ? 'Catch updated. Everything Compendium updated.' : 'Catch logged. Everything Compendium updated.');
    } catch (error) {
      const message = error?.message || 'This catch could not be saved.';
      byId('catch-form-error').textContent = message;
      byId('catch-form-error').hidden = false;
    }
  }

  function handleHistory(event) {
    const edit = event.target.closest('[data-edit-catch]');
    if (edit) { editCatch(edit.dataset.editCatch); return; }
    const remove = event.target.closest('[data-delete-catch]');
    if (!remove) return;
    const catchId = remove.dataset.deleteCatch;
    if (state.deleteId !== catchId) {
      state.deleteId = catchId;
      renderHistory();
      byId('catch-history').querySelector(`[data-delete-catch="${CSS.escape(catchId)}"]`)?.focus();
      return;
    }
    try {
      store.deleteCatch(state.fish.id, state.association.locationId, catchId);
      if (state.editingId === catchId) beginNew();
      state.deleteId = null;
      renderHistory();
      emit('Catch deleted. Its checklist completion was kept.');
    } catch (error) {
      root.dispatchEvent(new CustomEvent('fishon:toast', { detail: error?.message || 'Catch could not be deleted.' }));
    }
  }

  function init() {
    if (state.initialized) return;
    state.initialized = true;
    byId('catch-form').addEventListener('submit', handleSubmit);
    byId('catch-history').addEventListener('click', handleHistory);
    byId('close-catch-dialog').addEventListener('click', close);
    byId('cancel-catch').addEventListener('click', close);
    byId('catch-dialog').addEventListener('click', event => { if (event.target === byId('catch-dialog')) close(); });
    byId('catch-dialog').addEventListener('close', () => {
      state.deleteId = null;
      if (state.returnFocus?.isConnected) state.returnFocus.focus();
    });
  }

  root.FishOnCatchLog = { init, open, close };
})(window);
