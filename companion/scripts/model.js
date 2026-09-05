(function (root, factory) {
  const completion = root.FishOnCompletionModel || (typeof require === 'function' ? require('./completion-model.js') : null);
  const api = factory(completion);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FishOnModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (completion) {
  'use strict';

  const rarityRank = { Unknown: 0, Common: 1, Rare: 2, Epic: 3, Legendary: 4, Mythical: 5, Special: 6 };
  const completionFields = ['normal', 'gigantic', 'albino', 'melanistic', 'trophy', 'fabled'];

  function completionSummary(entry, association = {}) {
    return completion
      ? completion.objectives(entry || {}, association.completionAvailability || {})
      : { caught: { complete: Boolean(entry?.normal), attainable: true }, done: completionFields.filter(field => entry?.[field]).length, total: completionFields.length };
  }

  function normalize(value) {
    return String(value ?? '').normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function entryKey(fishId, locationId) {
    return `${fishId}::${locationId}`;
  }

  function getEntry(progress, fishId, locationId) {
    return progress?.entries?.[entryKey(fishId, locationId)] ?? null;
  }

  function relevantAssociations(fish, locationId) {
    return locationId ? fish.locations.filter(location => location.locationId === locationId) : fish.locations;
  }

  function associationMatches(association, query) {
    if (query.location && association.locationId !== query.location) return false;
    if (query.water && association.water !== query.water) return false;
    if (query.climate && association.climate !== query.climate) return false;
    if (query.rarity && association.rarity !== query.rarity) return false;
    if (query.group && association.group !== query.group) return false;
    if (query.lifestyle && association.lifestyle !== query.lifestyle) return false;
    if (query.ecosystemRole && association.ecosystemRole !== query.ecosystemRole) return false;
    if (query.availability === 'current' && association.eventOnly) return false;
    if (query.availability === 'event' && !association.eventOnly) return false;
    return true;
  }

  function searchMatches(fish, search) {
    if (!search) return true;
    const haystack = normalize([
      fish.name,
      fish.scientificName,
      fish.description,
      fish.eventName,
      ...(fish.groups || []),
      ...(fish.lifestyles || []),
      ...(fish.ecosystemRoles || []),
      ...fish.locations.flatMap(location => [location.locationName, location.climate, location.water, location.rarity, location.group])
    ].join(' '));
    return normalize(search).split(/\s+/).every(term => haystack.includes(term));
  }

  function progressMatches(fish, associations, mode, progress) {
    if (!mode) return true;
    const entries = associations.map(location => getEntry(progress, fish.id, location.locationId));
    if (mode === 'caught') return associations.some((association, index) => completionSummary(entries[index], association).caught.complete);
    if (mode === 'missing') return associations.some((association, index) => !completionSummary(entries[index], association).caught.complete);
    if (mode === 'any-missing') return associations.some((association, index) => { const summary = completionSummary(entries[index], association); return summary.done < summary.total; });
    return true;
  }

  function filterFish(fish, query = {}, progress = null) {
    return fish.filter(record => {
      if (!searchMatches(record, query.search)) return false;
      const associations = record.locations.filter(location => associationMatches(location, query));
      if (!associations.length) return false;
      return progressMatches(record, associations, query.progress, progress);
    });
  }

  function sortFish(fish, sortKey = 'name', progress = null, locationId = '') {
    const copy = [...fish];
    const maxRarity = record => Math.max(...relevantAssociations(record, locationId).map(location => rarityRank[location.rarity] ?? 0), 0);
    const earliest = record => Math.min(...relevantAssociations(record, locationId).map(location => Number.isFinite(location.unlockLevel) ? location.unlockLevel : 999), 999);
    const completion = record => {
      const associations = relevantAssociations(record, locationId);
      const summaries = associations.map(location => {
        const entry = getEntry(progress, record.id, location.locationId);
        return completionSummary(entry, location);
      });
      const total = summaries.reduce((sum, summary) => sum + summary.total, 0);
      const done = summaries.reduce((sum, summary) => sum + summary.done, 0);
      return total ? done / total : 0;
    };

    copy.sort((a, b) => {
      if (sortKey === 'rarity-desc') return maxRarity(b) - maxRarity(a) || a.name.localeCompare(b.name);
      if (sortKey === 'unlock') return earliest(a) - earliest(b) || a.name.localeCompare(b.name);
      if (sortKey === 'weight-desc') return (b.maximumWeightLb ?? -1) - (a.maximumWeightLb ?? -1) || a.name.localeCompare(b.name);
      if (sortKey === 'completion') return completion(a) - completion(b) || a.name.localeCompare(b.name);
      return a.name.localeCompare(b.name);
    });
    return copy;
  }

  function calculateVariantOdds(baseDenominator, bonusPercent) {
    const base = Number(baseDenominator);
    const bonus = Number(bonusPercent);
    if (!Number.isFinite(base) || base <= 0 || !Number.isFinite(bonus) || bonus < 0) return null;
    return base / (1 + bonus / 100);
  }

  function associationFor(fish, locationId) {
    return fish.locations.find(location => location.locationId === locationId) ?? fish.locations.find(location => !location.eventOnly) ?? fish.locations[0] ?? null;
  }

  function uniqueSorted(values) {
    return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
  }

  function options(data, dimension) {
    if (dimension === 'location') return data.locations.map(location => ({ value: location.id, label: `${location.name} (${formatUnlockLevel(location.unlockLevel)})` }));
    if (dimension === 'water') return uniqueSorted(data.locations.map(location => location.water)).map(value => ({ value, label: value }));
    if (dimension === 'climate') return uniqueSorted(data.locations.map(location => location.climate)).map(value => ({ value, label: value }));
    const fieldMap = { rarity: 'rarities', group: 'groups', lifestyle: 'lifestyles', ecosystemRole: 'ecosystemRoles' };
    return uniqueSorted(data.fish.flatMap(fish => fish[fieldMap[dimension]] || [])).map(value => ({ value, label: value }));
  }

  function percentage(done, total) {
    return total ? (done / total) * 100 : 0;
  }

  function formatWeight(value) {
    if (!Number.isFinite(value)) return 'Not published';
    return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} lb`;
  }

  function formatUnlockLevel(value) {
    return Number.isFinite(value) ? `Lv ${value}` : 'Unlock level pending';
  }

  return {
    rarityRank,
    completionFields,
    completionSummary,
    normalize,
    entryKey,
    getEntry,
    filterFish,
    sortFish,
    calculateVariantOdds,
    associationFor,
    options,
    percentage,
    formatWeight,
    formatUnlockLevel
  };
});
