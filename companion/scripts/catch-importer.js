(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FishOnCatchImporter = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const variants = new Set(['normal', 'gigantic', 'albino', 'melanistic', 'trophy', 'fabled']);
  const normalized = value => String(value ?? '').trim().toLocaleLowerCase('en-US').normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

  function existingIds(store) {
    const ids = new Set();
    const entries = store.load()?.entries || {};
    for (const entry of Object.values(entries)) for (const record of entry?.catches || []) if (record?.id) ids.add(String(record.id));
    return ids;
  }

  function resolveTarget(data, event) {
    const fishMatches = (data?.fish || []).filter(fish => normalized(fish?.name) === normalized(event?.fishName));
    if (fishMatches.length !== 1) return null;
    const fish = fishMatches[0];
    const locations = Array.isArray(fish.locations) ? fish.locations : [];
    const named = normalized(event?.locationName);
    let candidates = named
      ? locations.filter(location => normalized(location?.locationName) === named)
      : locations.filter(location => !location?.eventOnly);
    if (named && candidates.length === 0) {
      const currentLocations = locations.filter(location => !location?.eventOnly);
      if (currentLocations.length === 1) candidates = currentLocations;
    }
    if (candidates.length !== 1) return null;
    return { fishId: fish.id, locationId: candidates[0].locationId };
  }

  function importCollection(data, store, collection) {
    if (!collection?.available || !Array.isArray(collection.items)) return { total: 0, added: 0, duplicates: 0, unresolved: 0, available: false };
    const ids = existingIds(store);
    const result = { total: collection.items.length, added: 0, duplicates: 0, unresolved: 0, available: true };
    for (const event of collection.items) {
      const id = String(event?.id || '').trim().slice(0, 160);
      if (!id) { result.unresolved += 1; continue; }
      if (ids.has(id)) { result.duplicates += 1; continue; }
      const target = resolveTarget(data, event);
      if (!target || !variants.has(event?.variant)) { result.unresolved += 1; continue; }
      try {
        const record = {
          id,
          caughtAt: event.caughtAt || null,
          weightLb: event.weightLb,
          lengthIn: event.lengthIn,
          variant: event.variant,
          source: 'observed',
          sessionTag: 'Minecraft auto-import'
        };
        if (event.source === 'fishon-catch-collector') Object.assign(record, {
          sizeTier: event.sizeTier ?? null,
          baitText: event.baitText ?? '',
          rod: event.rod ?? '',
          reel: event.reel ?? '',
          line: event.line ?? '',
          armor: Array.isArray(event.armor) ? event.armor.join(' • ') : event.armor ?? '',
          pet: event.pet ?? '',
          dayPhase: event.dayPhase ?? null,
          weather: event.weather ?? null,
          subLocation: event.subLocation ?? '',
          temperature: event.temperature ?? '',
          observedRarity: event.rarity ?? '',
          sessionTag: event.sessionTag || 'Minecraft auto-import'
        });
        store.addCatch(target.fishId, target.locationId, record);
        ids.add(id);
        result.added += 1;
      } catch {
        result.unresolved += 1;
      }
    }
    return result;
  }

  return { importCollection, resolveTarget };
});
