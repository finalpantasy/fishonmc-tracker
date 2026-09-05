(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FishOnDashboardModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const statusLabels = {
    live: 'Live — Extras data connected',
    stale: 'Stale — showing last valid Extras snapshot',
    offline: 'Offline — manual guide remains available',
    'selection-required': 'Profile selection required'
  };

  function stripMarkup(value) {
    return String(value ?? '').replace(/<[^>]*>/g, '').replace(/[<>]/g, '').slice(0, 300);
  }

  function yesNoUnknown(value) {
    return value === true ? 'Yes' : value === false ? 'No' : 'Unknown';
  }

  function breakdown(raw) {
    if (!raw || typeof raw !== 'object') return [];
    return Object.entries(raw)
      .filter(([, value]) => Number.isFinite(Number(value)) && Number(value) >= 0)
      .map(([label, value]) => ({ label, value: Number(value) }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  const round = (value, places = 3) => Number(Number(value).toFixed(places));
  const numeric = value => Number.isFinite(Number(value)) && Number(value) >= 0;
  function unavailableCatchInsights() {
    return {
      available: false, eventCount: 0, uniqueFish: 0, uniqueLocations: 0, totalWeightLb: null,
      meanWeightLb: null, durationMinutes: null, pacePerHour: null, heaviest: null, longest: null,
      biggestImprovement: null, topFish: [], locations: [], timeline: [], recent: []
    };
  }

  function catchInsights(collection) {
    if (!collection?.available || !Array.isArray(collection.items)) return unavailableCatchInsights();
    const events = collection.items.filter(event => event && typeof event === 'object' && event.fishName);
    const dated = events.filter(event => Number.isFinite(Date.parse(event.caughtAt))).sort((a, b) => Date.parse(a.caughtAt) - Date.parse(b.caughtAt));
    const weights = events.filter(event => numeric(event.weightLb));
    const lengths = events.filter(event => numeric(event.lengthIn));
    const totalWeightLb = weights.length ? round(weights.reduce((sum, event) => sum + Number(event.weightLb), 0)) : null;
    const meanWeightLb = weights.length ? round(totalWeightLb / weights.length) : null;
    const heaviest = weights.slice().sort((a, b) => Number(b.weightLb) - Number(a.weightLb) || String(a.id).localeCompare(String(b.id)))[0] || null;
    const longest = lengths.slice().sort((a, b) => Number(b.lengthIn) - Number(a.lengthIn) || String(a.id).localeCompare(String(b.id)))[0] || null;
    const fishGroups = new Map();
    const locationGroups = new Map();
    for (const event of events) {
      const fishName = stripMarkup(event.fishName || 'Unknown fish');
      const locationName = stripMarkup(event.locationName || 'Location unavailable');
      const fish = fishGroups.get(fishName) || { label: fishName, count: 0, totalWeightLb: 0, weightCount: 0 };
      fish.count += 1;
      if (numeric(event.weightLb)) { fish.totalWeightLb += Number(event.weightLb); fish.weightCount += 1; }
      fishGroups.set(fishName, fish);
      locationGroups.set(locationName, (locationGroups.get(locationName) || 0) + 1);
    }
    const topFish = [...fishGroups.values()].map(group => ({
      label: group.label, count: group.count, totalWeightLb: round(group.totalWeightLb),
      meanWeightLb: group.weightCount ? round(group.totalWeightLb / group.weightCount) : null
    })).sort((a, b) => b.count - a.count || b.totalWeightLb - a.totalWeightLb || a.label.localeCompare(b.label));
    const locations = [...locationGroups.entries()].map(([label, count]) => ({
      label, count, percent: events.length ? round((count / events.length) * 100, 2) : 0
    })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
    const previousWeight = new Map();
    let biggestImprovement = null;
    for (const event of dated) {
      if (!numeric(event.weightLb)) continue;
      const key = stripMarkup(event.fishName);
      const previous = previousWeight.get(key);
      const current = Number(event.weightLb);
      if (numeric(previous) && current > previous) {
        const gainLb = round(current - previous);
        if (!biggestImprovement || gainLb > biggestImprovement.gainLb) biggestImprovement = {
          fishName: key, fromWeightLb: previous, toWeightLb: current, gainLb, caughtAt: event.caughtAt
        };
      }
      previousWeight.set(key, current);
    }
    let durationMinutes = null;
    let pacePerHour = null;
    const timeline = [];
    if (dated.length >= 2) {
      const firstTime = Date.parse(dated[0].caughtAt);
      const lastTime = Date.parse(dated.at(-1).caughtAt);
      durationMinutes = round((lastTime - firstTime) / 60000, 1);
      pacePerHour = durationMinutes > 0 ? round(events.length / (durationMinutes / 60), 2) : null;
      const span = lastTime - firstTime;
      const bucketMs = span <= 3 * 3600000 ? 15 * 60000 : span <= 12 * 3600000 ? 3600000 : 6 * 3600000;
      const start = Math.floor(firstTime / bucketMs) * bucketMs;
      const end = Math.floor(lastTime / bucketMs) * bucketMs;
      const counts = new Map();
      for (const event of dated) {
        const at = Math.floor(Date.parse(event.caughtAt) / bucketMs) * bucketMs;
        counts.set(at, (counts.get(at) || 0) + 1);
      }
      for (let at = start; at <= end; at += bucketMs) timeline.push({ at: new Date(at).toISOString(), count: counts.get(at) || 0 });
    }
    return {
      available: true,
      eventCount: events.length,
      uniqueFish: fishGroups.size,
      uniqueLocations: locationGroups.size,
      totalWeightLb,
      meanWeightLb,
      durationMinutes,
      pacePerHour,
      heaviest,
      longest,
      biggestImprovement,
      topFish: topFish.slice(0, 6),
      locations,
      timeline,
      recent: dated.slice(-8).reverse()
    };
  }

  function fromSnapshot(snapshot) {
    if (!snapshot || snapshot.schemaVersion !== 1) throw new Error('Unsupported live snapshot schema.');
    const status = statusLabels[snapshot.freshness?.state] ? snapshot.freshness.state : 'offline';
    const profile = snapshot.profile;
    const stats = snapshot.aggregateStats;
    const profileFlags = profile ? [
      { label: 'Active pet slot', value: Number.isSafeInteger(profile.activePetSlot) && profile.activePetSlot >= 0 ? `Slot ${profile.activePetSlot + 1}` : 'Unknown' },
      { label: 'Tournament contribution', value: yesNoUnknown(profile.tournamentContribution) },
      { label: 'Stats imported', value: yesNoUnknown(profile.hasImportedStats) },
      { label: 'Crew imported', value: yesNoUnknown(profile.hasImportedCrew) },
      { label: 'Crew chat', value: yesNoUnknown(profile.isInCrewChat) }
    ] : null;
    const quests = (Array.isArray(snapshot.quests) ? snapshot.quests : []).map(quest => {
      const current = Math.max(0, Number(quest.current) || 0);
      const target = Math.max(0, Number(quest.target) || 0);
      return {
        id: String(quest.id || ''),
        title: stripMarkup(quest.title || 'Active quest'),
        current,
        target,
        complete: Boolean(quest.complete),
        percent: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0
      };
    });
    return {
      status,
      statusLabel: statusLabels[status],
      freshnessText: snapshot.connection?.dataAgeMs == null ? 'Freshness unavailable' : `Updated ${Math.max(0, Math.round(snapshot.connection.dataAgeMs / 1000))}s ago`,
      observedAt: snapshot.observedAt || null,
      connection: {
        gameRunning: snapshot.connection?.gameRunning ?? null,
        onFishOnMC: snapshot.connection?.onFishOnMC ?? null,
        extrasVersion: snapshot.connection?.extrasVersion ?? null
      },
      totals: stats?.totals ? { ...stats.totals } : null,
      breakdowns: {
        rarity: breakdown(stats?.fish?.byRarity),
        variant: breakdown(stats?.fish?.byVariant),
        size: breakdown(stats?.fish?.bySize)
      },
      profileFlags,
      quests,
      catchInsights: catchInsights(snapshot.catches),
      recommendations: (Array.isArray(snapshot.recommendations) ? snapshot.recommendations : []).map(item => ({
        id: String(item.id || ''), title: stripMarkup(item.title), reason: stripMarkup(item.reason),
        evidence: stripMarkup(item.evidence), action: item.action && typeof item.action === 'object' ? { ...item.action } : null
      })),
      unavailable: [
        'Current equipment and active-loadout compatibility',
        ...(snapshot.catches?.available ? [] : ['Recent catches and personal records']),
        'Session charts, non-PB catches, rewards, level, and wallet'
      ],
      warnings: (Array.isArray(snapshot.warnings) ? snapshot.warnings : []).map(warning => ({
        code: String(warning.code || 'WARNING').slice(0, 80), message: stripMarkup(warning.message)
      }))
    };
  }

  return { fromSnapshot, catchInsights };
});
