(function (root, factory) {
  const completion = root.FishOnCompletionModel || (typeof require === 'function' ? require('./completion-model.js') : null);
  const api = factory(completion);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FishOnCatchStats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (completion) {
  'use strict';

  const variants = ['normal', 'gigantic', 'albino', 'melanistic', 'trophy', 'fabled'];
  const sizeTiers = ['baby', 'juvenile', 'adult', 'large', 'gigantic'];

  function completionStats(entry = {}, association = {}) {
    return completion.objectives(entry, association.completionAvailability || {});
  }
  const numeric = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
  const round = (value, places = 4) => value == null ? null : Number(value.toFixed(places));
  const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

  function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  }

  function variantCounts(catches) {
    const output = Object.fromEntries(variants.map(variant => [variant, 0]));
    for (const record of catches) if (Object.prototype.hasOwnProperty.call(output, record?.variant)) output[record.variant] += 1;
    return output;
  }

  function categoryCounts(catches, values, selector) {
    const output = Object.fromEntries(values.map(value => [value, 0]));
    for (const record of catches) {
      const value = selector(record);
      if (Object.prototype.hasOwnProperty.call(output, value)) output[value] += 1;
    }
    return output;
  }

  function contextCounts(catches) {
    return {
      event: catches.filter(record => record?.eventCatch).length,
      tournament: catches.filter(record => record?.tournamentCatch).length,
      quest: catches.filter(record => record?.questCatch).length
    };
  }

  function bonusAverages(catches) {
    return Object.fromEntries(['luckBonus', 'variantBonus', 'scaleBonus', 'biteSpeedBonus', 'moneyBonus', 'power'].map(field => {
      const values = catches.map(record => record?.[field]).filter(numeric);
      return [field, round(mean(values))];
    }));
  }

  function groupOutcomes(catches, selector) {
    const groups = new Map();
    for (const record of catches) {
      const key = selector(record);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    }
    return [...groups.entries()].map(([key, records]) => {
      const weights = records.map(record => record.weightLb).filter(numeric);
      return { key, sampleCount: records.length, weightCount: weights.length, meanWeightLb: round(mean(weights)), maxWeightLb: weights.length ? Math.max(...weights) : null };
    }).sort((a, b) => b.sampleCount - a.sampleCount || (b.meanWeightLb ?? -1) - (a.meanWeightLb ?? -1) || String(a.key).localeCompare(String(b.key)));
  }

  function sessionCadence(catches) {
    const groups = new Map();
    for (const record of catches) {
      if (!record?.sessionTag || !record.caughtAt || !Number.isFinite(Date.parse(record.caughtAt))) continue;
      if (!groups.has(record.sessionTag)) groups.set(record.sessionTag, []);
      groups.get(record.sessionTag).push(record);
    }
    return [...groups.entries()].map(([sessionTag, records]) => {
      const times = records.map(record => Date.parse(record.caughtAt)).sort((a, b) => a - b);
      const durationHours = times.length > 1 ? (times.at(-1) - times[0]) / 3600000 : 0;
      return {
        sessionTag,
        count: records.length,
        firstCaughtAt: new Date(times[0]).toISOString(),
        lastCaughtAt: new Date(times.at(-1)).toISOString(),
        durationHours: round(durationHours),
        loggedPerHour: durationHours > 0 ? round(records.length / durationHours) : null
      };
    }).sort((a, b) => b.count - a.count || String(a.sessionTag).localeCompare(String(b.sessionTag)));
  }

  function recordChronology(catches) {
    const ordered = catches.filter(record => numeric(record?.weightLb)).sort((a, b) => {
      const aTime = Date.parse(a.caughtAt || a.createdAt || 0) || 0;
      const bTime = Date.parse(b.caughtAt || b.createdAt || 0) || 0;
      return aTime - bTime || String(a.id).localeCompare(String(b.id));
    });
    const records = [];
    let previous = -1;
    for (const record of ordered) {
      if (record.weightLb <= previous) continue;
      records.push({ catchId: record.id, caughtAt: record.caughtAt || null, weightLb: record.weightLb, improvementLb: previous < 0 ? null : round(record.weightLb - previous) });
      previous = record.weightLb;
    }
    return records;
  }

  function completeness(catches) {
    if (!catches.length) return { score: null, completed: 0, possible: 0 };
    const checks = [
      record => Boolean(record.caughtAt),
      record => numeric(record.weightLb),
      record => numeric(record.lengthIn),
      record => Boolean(record.baitId || record.baitText),
      record => Boolean(record.rod || record.reel || record.line || record.armor || record.pet),
      record => numeric(record.valueCoins) || numeric(record.xp),
      record => Boolean(record.dayPhase || record.weather || record.eventCatch || record.tournamentCatch || record.questCatch)
    ];
    const completed = catches.reduce((total, record) => total + checks.filter(check => check(record)).length, 0);
    const possible = catches.length * checks.length;
    return { score: round((completed / possible) * 100, 2), completed, possible };
  }

  function entryStats(entry = {}, fish = {}) {
    const catches = Array.isArray(entry?.catches) ? entry.catches : [];
    const weights = catches.map(record => record.weightLb).filter(numeric);
    const lengths = catches.map(record => record.lengthIn).filter(numeric);
    const coins = catches.map(record => record.valueCoins).filter(numeric);
    const xp = catches.map(record => record.xp).filter(numeric);
    const fights = catches.filter(record => numeric(record.fightSeconds) && numeric(record.weightLb));
    const fightSeconds = catches.map(record => record.fightSeconds).filter(numeric);
    const minWeightLb = weights.length ? Math.min(...weights) : null;
    const maxLoggedWeightLb = weights.length ? Math.max(...weights) : null;
    const minLengthIn = lengths.length ? Math.min(...lengths) : null;
    const maxLoggedLengthIn = lengths.length ? Math.max(...lengths) : null;
    const legacyMax = numeric(entry?.bestWeightLb) ? entry.bestWeightLb : null;
    const personalMaxWeightLb = [maxLoggedWeightLb, legacyMax].filter(numeric).sort((a, b) => b - a)[0] ?? null;
    const publishedMaximum = numeric(fish?.maximumWeightLb) && fish.maximumWeightLb > 0 ? fish.maximumWeightLb : null;
    const latestAt = catches.map(record => record.caughtAt || record.updatedAt || record.createdAt).filter(value => Number.isFinite(Date.parse(value))).sort().at(-1) || null;
    return {
      count: catches.length,
      weightCount: weights.length,
      lengthCount: lengths.length,
      minWeightLb,
      meanWeightLb: round(mean(weights)),
      medianWeightLb: round(median(weights)),
      maxLoggedWeightLb,
      personalMaxWeightLb,
      meanLengthIn: round(mean(lengths)),
      medianLengthIn: round(median(lengths)),
      minLengthIn,
      maxLoggedLengthIn,
      maxLengthIn: [maxLoggedLengthIn, numeric(entry?.bestLengthIn) ? entry.bestLengthIn : null].filter(numeric).sort((a, b) => b - a)[0] ?? null,
      lengthRangeIn: minLengthIn !== null && maxLoggedLengthIn !== null ? round(maxLoggedLengthIn - minLengthIn) : null,
      weightRangeLb: minWeightLb !== null && maxLoggedWeightLb !== null ? round(maxLoggedWeightLb - minWeightLb) : null,
      publishedMaxPercent: personalMaxWeightLb !== null && publishedMaximum ? round((personalMaxWeightLb / publishedMaximum) * 100, 2) : null,
      variantCounts: variantCounts(catches),
      sizeTierCounts: categoryCounts(catches, sizeTiers, record => record?.sizeTier),
      contextCounts: contextCounts(catches),
      bonusAverages: bonusAverages(catches),
      totalCoins: coins.length ? round(coins.reduce((sum, value) => sum + value, 0)) : null,
      meanCoins: round(mean(coins)),
      totalXp: xp.length ? round(xp.reduce((sum, value) => sum + value, 0)) : null,
      meanXp: round(mean(xp)),
      meanFightSeconds: round(mean(fightSeconds)),
      weightPerFightSecond: fights.length ? round(fights.reduce((sum, record) => sum + record.weightLb, 0) / fights.reduce((sum, record) => sum + record.fightSeconds, 0)) : null,
      sessionCadence: sessionCadence(catches),
      recordChronology: recordChronology(catches),
      completeness: completeness(catches),
      latestAt
    };
  }

  function associationRows(data, progress, includeEvents = true) {
    return (data?.fish || []).flatMap(fish => (fish.locations || [])
      .filter(association => includeEvents || !association.eventOnly)
      .map(association => {
        const entry = progress?.entries?.[`${fish.id}::${association.locationId}`] || null;
        const calculated = entryStats(entry || {}, fish);
        return { fish, association, entry, stats: calculated, latestAt: calculated.latestAt };
      }));
  }

  function allCatches(data, progress, includeEvents = true) {
    return associationRows(data, progress, includeEvents).flatMap(row => (row.entry?.catches || []).map(record => ({ ...row, catch: record })));
  }

  function caught(row) {
    return row.stats.count > 0 || variants.some(variant => row.entry?.[variant]);
  }

  function groupGlobal(records, selector) {
    const owners = new Map(records.map(record => [record.catch, record]));
    return groupOutcomes(records.map(record => record.catch), record => selector(owners.get(record)));
  }

  function globalStats(data, progress, includeEvents = true) {
    const rows = associationRows(data, progress, includeEvents);
    const records = allCatches(data, progress, includeEvents);
    const weights = records.map(record => record.catch.weightLb).filter(numeric);
    const lengths = records.map(record => record.catch.lengthIn).filter(numeric);
    const coins = records.map(record => record.catch.valueCoins).filter(numeric);
    const xp = records.map(record => record.catch.xp).filter(numeric);
    const fightSeconds = records.map(record => record.catch.fightSeconds).filter(numeric);
    const fightPairs = records.filter(record => numeric(record.catch.fightSeconds) && numeric(record.catch.weightLb));
    const dated = records.filter(record => record.catch.caughtAt && Number.isFinite(Date.parse(record.catch.caughtAt)));
    const activeDates = new Set(dated.map(record => record.catch.caughtAt.slice(0, 10)));
    const heaviest = records.filter(record => numeric(record.catch.weightLb)).sort((a, b) => b.catch.weightLb - a.catch.weightLb || String(a.catch.id).localeCompare(String(b.catch.id)))[0] || null;
    const compared = records.filter(record => numeric(record.catch.weightLb) && numeric(record.fish.maximumWeightLb) && record.fish.maximumWeightLb > 0)
      .map(record => ({ ...record, percent: round((record.catch.weightLb / record.fish.maximumWeightLb) * 100, 2) }))
      .sort((a, b) => b.percent - a.percent || b.catch.weightLb - a.catch.weightLb);
    const variantTotals = Object.fromEntries(variants.map(variant => [variant, 0]));
    for (const record of records) if (variantTotals[record.catch.variant] !== undefined) variantTotals[record.catch.variant] += 1;
    const missingHighRarity = rows.filter(row => ['Legendary', 'Mythical'].includes(row.association.rarity) && !row.entry?.normal);
    const byLocation = new Map();
    for (const row of rows) {
      const current = byLocation.get(row.association.locationId) || { id: row.association.locationId, name: row.association.locationName, caught: 0, total: 0 };
      current.total += 1;
      if (caught(row)) current.caught += 1;
      byLocation.set(current.id, current);
    }
    const locations = [...byLocation.values()].map(location => ({ ...location, percent: location.total ? round((location.caught / location.total) * 100, 2) : 0 }))
      .sort((a, b) => b.percent - a.percent || b.caught - a.caught || String(a.name).localeCompare(String(b.name)));
    const widestRange = rows.filter(row => row.stats.weightRangeLb !== null).sort((a, b) => b.stats.weightRangeLb - a.stats.weightRangeLb || a.fish.name.localeCompare(b.fish.name))[0] || null;
    return {
      totalLoggedCatches: records.length,
      weightCount: weights.length,
      totalWeightLb: weights.length ? round(weights.reduce((sum, value) => sum + value, 0)) : null,
      minWeightLb: weights.length ? Math.min(...weights) : null,
      maxWeightLb: weights.length ? Math.max(...weights) : null,
      meanWeightLb: round(mean(weights)),
      medianWeightLb: round(median(weights)),
      lengthCount: lengths.length,
      minLengthIn: lengths.length ? Math.min(...lengths) : null,
      meanLengthIn: round(mean(lengths)),
      medianLengthIn: round(median(lengths)),
      maxLengthIn: lengths.length ? Math.max(...lengths) : null,
      totalCoins: coins.length ? round(coins.reduce((sum, value) => sum + value, 0)) : null,
      meanCoins: round(mean(coins)),
      totalXp: xp.length ? round(xp.reduce((sum, value) => sum + value, 0)) : null,
      meanXp: round(mean(xp)),
      meanFightSeconds: round(mean(fightSeconds)),
      weightPerFightSecond: fightPairs.length ? round(fightPairs.reduce((sum, record) => sum + record.catch.weightLb, 0) / fightPairs.reduce((sum, record) => sum + record.catch.fightSeconds, 0)) : null,
      contextTotals: contextCounts(records.map(record => record.catch)),
      sizeTierTotals: categoryCounts(records.map(record => record.catch), sizeTiers, record => record?.sizeTier),
      bonusAverages: bonusAverages(records.map(record => record.catch)),
      datedCount: dated.length,
      firstCaughtAt: dated.map(record => record.catch.caughtAt).sort()[0] || null,
      latestCaughtAt: dated.map(record => record.catch.caughtAt).sort().at(-1) || null,
      activeDays: activeDates.size,
      catchesPerActiveDay: activeDates.size ? round(dated.length / activeDates.size) : null,
      heaviest: heaviest ? { ...heaviest.catch, catchId: heaviest.catch.id, fishId: heaviest.fish.id, fishName: heaviest.fish.name, locationId: heaviest.association.locationId, locationName: heaviest.association.locationName } : null,
      closestToPublished: compared[0] ? { ...compared[0].catch, catchId: compared[0].catch.id, fishId: compared[0].fish.id, fishName: compared[0].fish.name, locationId: compared[0].association.locationId, locationName: compared[0].association.locationName, percent: compared[0].percent } : null,
      caughtAssociations: rows.filter(caught).length,
      totalAssociations: rows.length,
      completionPercent: rows.length ? round((rows.filter(caught).length / rows.length) * 100, 2) : 0,
      variantTotals,
      missingHighRarity,
      mostCompleteLocation: locations[0] || null,
      widestRange,
      topBaits: groupGlobal(records, record => record.catch.baitId || record.catch.baitText),
      topPets: groupGlobal(records, record => record.catch.pet),
      topArmor: groupGlobal(records, record => record.catch.armor),
      topRods: groupGlobal(records, record => record.catch.rod),
      topReels: groupGlobal(records, record => record.catch.reel),
      topLines: groupGlobal(records, record => record.catch.line),
      topDayPhases: groupGlobal(records, record => record.catch.dayPhase),
      topWeather: groupGlobal(records, record => record.catch.weather),
      topSessions: groupGlobal(records, record => record.catch.sessionTag),
      completeness: completeness(records.map(record => record.catch))
    };
  }

  function filterRows(rows, query = {}) {
    const search = String(query.search || '').trim().toLowerCase();
    return rows.filter(row => {
      if (search && !`${row.fish.name} ${row.association.locationName}`.toLowerCase().includes(search)) return false;
      if (query.location && row.association.locationId !== query.location) return false;
      if (query.water && row.association.water !== query.water) return false;
      if (query.rarity && row.association.rarity !== query.rarity) return false;
      if (query.status === 'caught' && !caught(row)) return false;
      if (query.status === 'missing' && caught(row)) return false;
      if (query.variant && !row.entry?.[query.variant] && !row.stats.variantCounts[query.variant]) return false;
      if (query.weight === 'complete' && !(row.stats.count > 0 && row.stats.weightCount === row.stats.count)) return false;
      if (query.weight === 'partial' && !(row.stats.weightCount > 0 && row.stats.weightCount < row.stats.count)) return false;
      if (query.weight === 'missing' && row.stats.weightCount > 0) return false;
      return true;
    });
  }

  function sortRows(rows, sortKey = 'name') {
    const output = [...rows];
    output.sort((a, b) => {
      if (sortKey === 'recent') return String(b.latestAt || '').localeCompare(String(a.latestAt || '')) || a.fish.name.localeCompare(b.fish.name);
      if (sortKey === 'count-desc') return b.stats.count - a.stats.count || a.fish.name.localeCompare(b.fish.name);
      if (sortKey === 'max-desc') return (b.stats.personalMaxWeightLb ?? -1) - (a.stats.personalMaxWeightLb ?? -1) || a.fish.name.localeCompare(b.fish.name);
      if (sortKey === 'published-desc') return (b.stats.publishedMaxPercent ?? -1) - (a.stats.publishedMaxPercent ?? -1) || a.fish.name.localeCompare(b.fish.name);
      if (sortKey === 'incomplete-first') return Number(caught(a)) - Number(caught(b)) || a.fish.name.localeCompare(b.fish.name);
      return a.fish.name.localeCompare(b.fish.name) || a.association.locationName.localeCompare(b.association.locationName);
    });
    return output;
  }

  return { variants, sizeTiers, completionStats, median, entryStats, associationRows, allCatches, globalStats, filterRows, sortRows };
});
