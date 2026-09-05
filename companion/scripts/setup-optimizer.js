(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FishOnSetupOptimizer = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const round = (value, places = 4) => Number(Number(value).toFixed(places));
  const clean = value => String(value ?? '').trim();

  function wilsonInterval(successCount, sampleCount, z = 1.96) {
    const n = Math.max(0, Math.floor(Number(sampleCount) || 0));
    const successes = Math.max(0, Math.min(n, Math.floor(Number(successCount) || 0)));
    if (!n) return { successCount: successes, sampleCount: n, observedShare: null, lower: null, upper: null };
    const share = successes / n;
    const z2 = z * z;
    const denominator = 1 + z2 / n;
    const center = (share + z2 / (2 * n)) / denominator;
    const margin = (z * Math.sqrt((share * (1 - share) + z2 / (4 * n)) / n)) / denominator;
    return {
      successCount: successes,
      sampleCount: n,
      observedShare: round(share),
      lower: round(Math.max(0, center - margin)),
      upper: round(Math.min(1, center + margin))
    };
  }

  function setupFrom(catchRow) {
    const setup = {
      rod: clean(catchRow?.rod), reel: clean(catchRow?.reel), line: clean(catchRow?.line),
      bait: clean(catchRow?.baitId || catchRow?.baitText), armor: clean(catchRow?.armor), pet: clean(catchRow?.pet)
    };
    if (Object.values(setup).some(value => !value)) return null;
    return setup;
  }

  function setupKey(setup) {
    return [setup.rod, setup.reel, setup.line, setup.bait, setup.armor, setup.pet].map(value => value.toLocaleLowerCase('en-US')).join('|');
  }

  function rankObservedSetups(catches, target, { minimumSample = 20 } = {}) {
    const atLocation = (Array.isArray(catches) ? catches : []).filter(item => item?.locationId === target?.locationId);
    const groups = new Map();
    let skippedIncomplete = 0;
    for (const item of atLocation) {
      const setup = setupFrom(item);
      if (!setup) { skippedIncomplete += 1; continue; }
      const key = setupKey(setup);
      const current = groups.get(key) || { ...setup, key, sampleCount: 0, successCount: 0 };
      current.sampleCount += 1;
      if (item.fishId === target?.fishId) current.successCount += 1;
      groups.set(key, current);
    }
    const setups = [...groups.values()].map(group => {
      const interval = wilsonInterval(group.successCount, group.sampleCount);
      const rankable = group.sampleCount >= minimumSample;
      return {
        ...group,
        observedShare: interval.observedShare,
        lower95: interval.lower,
        upper95: interval.upper,
        rankable,
        evidence: rankable ? 'observed-directional' : 'insufficient-sample'
      };
    }).sort((a, b) => Number(b.rankable) - Number(a.rankable)
      || (b.lower95 ?? -1) - (a.lower95 ?? -1)
      || (b.observedShare ?? -1) - (a.observedShare ?? -1)
      || b.sampleCount - a.sampleCount
      || a.key.localeCompare(b.key));
    return { eligibleCatchCount: atLocation.length - skippedIncomplete, skippedIncomplete, setups };
  }

  function flattenProgress(progress) {
    const output = [];
    for (const entry of Object.values(progress?.entries || {})) {
      for (const catchRow of Array.isArray(entry?.catches) ? entry.catches : []) {
        output.push({ ...catchRow, fishId: entry.fishId, locationId: entry.locationId });
      }
    }
    return output;
  }

  function publishedBaits(data, fish, association) {
    return (fish.relevantBaitIds || []).map(id => data.baits?.find(bait => bait.id === id)).filter(Boolean).map(bait => {
      if ((bait.targetSpecies || []).includes(fish.name)) return { id: bait.id, name: bait.name, basis: 'published-species-target' };
      if (association.group && (bait.targetGroups || []).includes(association.group)) return { id: bait.id, name: bait.name, basis: 'published-group-target' };
      if ((bait.locations || []).includes(association.locationName)) return { id: bait.id, name: bait.name, basis: 'published-location-target' };
      if ((bait.waterTypes || []).includes(association.water)) return { id: bait.id, name: bait.name, basis: 'published-water-match' };
      return null;
    }).filter(Boolean);
  }

  function planTargetFish(data, progress, targetFishId) {
    const fish = data?.fish?.find(item => item.id === targetFishId);
    if (!fish) return null;
    const catches = flattenProgress(progress);
    return {
      fishId: fish.id,
      fishName: fish.name,
      locations: (fish.locations || []).filter(association => !association.eventOnly).map(association => ({
        locationId: association.locationId,
        locationName: association.locationName,
        rarity: association.rarity,
        water: association.water,
        group: association.group,
        climate: association.climate,
        publishedBaits: publishedBaits(data, fish, association),
        observed: rankObservedSetups(catches, { fishId: fish.id, locationId: association.locationId })
      }))
    };
  }

  return { wilsonInterval, rankObservedSetups, planTargetFish };
});
