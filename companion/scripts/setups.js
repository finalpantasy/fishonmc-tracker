(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FishOnSetups = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function rankBaits(data, fish, association) {
    const records = fish.relevantBaitIds.map(id => data.baits.find(bait => bait.id === id)).filter(Boolean);
    return records.map(bait => {
      let rank = 0;
      let evidence = 'Broad water match';
      if (bait.targetSpecies.includes(fish.name)) { rank = 4; evidence = 'Official species-target effect'; }
      else if (association?.group && bait.targetGroups.includes(association.group)) { rank = 3; evidence = 'Official fish-group effect'; }
      else if (association && bait.locations.includes(association.locationName)) { rank = 2; evidence = 'Official location-target effect'; }
      else if (association && bait.waterTypes.includes(association.water)) { rank = 1; evidence = 'Official water-type effect'; }
      return { bait, rank, evidence };
    }).filter(item => item.rank > 0).sort((a, b) => b.rank - a.rank || a.bait.name.localeCompare(b.bait.name));
  }

  function includesText(text, value) {
    return Boolean(value) && text.toLowerCase().includes(String(value).toLowerCase());
  }

  function splitEffectProfiles(effect) {
    const text = String(effect || '').trim();
    if (!text) return [];
    const matches = [...text.matchAll(/\b(?:\d+\/\d+|\d+(?:\.\d+)?)(?:oz|in)\b/gi)];
    if (!matches.length) return [text];
    return matches.map((match, index) => text.slice(match.index, matches[index + 1]?.index ?? text.length).trim());
  }

  function profileMatch(segment, bait, fish, association) {
    if (includesText(segment, fish?.name)) return { matchRank: 4, evidence: 'Official species-target effect', selectedTarget: true };
    if (includesText(segment, association?.group)) return { matchRank: 3, evidence: 'Official fish-group effect', selectedTarget: true };
    if (includesText(segment, association?.locationName)) return { matchRank: 2, evidence: 'Official location-target effect', selectedTarget: false };
    if (includesText(segment, association?.water)) return { matchRank: 1, evidence: 'Official water-type effect', selectedTarget: false };
    return { matchRank: 0, evidence: '', selectedTarget: false };
  }

  function numericModifier(segment, label) {
    const match = segment.match(new RegExp(`${label}s?:\\s*([+-]?\\d+(?:\\.\\d+)?)%?`, 'i'));
    return match ? Number(match[1]) : null;
  }

  function parseEffectProfiles(bait, fish, association) {
    return (bait.effects || []).flatMap(splitEffectProfiles).map(segment => {
      const match = profileMatch(segment, bait, fish, association);
      if (!match.matchRank) return null;
      const mentionedTargets = [...(bait.targetSpecies || []), ...(bait.targetGroups || [])].filter(target => includesText(segment, target));
      const targetedElsewhere = mentionedTargets.length > 0 && !match.selectedTarget;
      return {
        label: segment.match(/^((?:\d+\/\d+|\d+(?:\.\d+)?)(?:oz|in))\b/i)?.[1] || null,
        biteSpeed: numericModifier(segment, 'Bite Speed'),
        likelihood: targetedElsewhere ? null : numericModifier(segment, 'Likelihood'),
        size: targetedElsewhere ? null : numericModifier(segment, 'Size'),
        matchRank: match.matchRank,
        evidence: match.evidence
      };
    }).filter(Boolean);
  }

  function metricScore(item, key) {
    const value = item.metrics[key].value;
    if (key === 'likelihood') return value ?? Number.NEGATIVE_INFINITY;
    return value ?? 0;
  }

  function bestBy(items, key, requirePublished = false) {
    const eligible = requirePublished ? items.filter(item => item.metrics[key].value != null) : items;
    return [...eligible].sort((a, b) =>
      metricScore(b, key) - metricScore(a, key) || b.rank - a.rank || a.bait.name.localeCompare(b.bait.name)
    )[0] || null;
  }

  function bestBalance(items) {
    const direct = items.filter(item => item.rank >= 3 && item.metrics.likelihood.value != null);
    const pool = direct.length ? direct : items.filter(item => item.metrics.likelihood.value != null);
    if (!pool.length) return bestBy(items, 'biteSpeed');
    const bestLikelihood = Math.max(...pool.map(item => item.metrics.likelihood.value));
    return pool.filter(item => item.metrics.likelihood.value >= bestLikelihood - 15).sort((a, b) =>
      metricScore(b, 'biteSpeed') - metricScore(a, 'biteSpeed') ||
      metricScore(b, 'likelihood') - metricScore(a, 'likelihood') ||
      b.rank - a.rank ||
      a.bait.name.localeCompare(b.bait.name)
    )[0] || null;
  }

  const reasonCopy = {
    'Best for money / throughput': 'Direct species/group match within 15 points of the highest published Likelihood, then the fastest Bite Speed.',
    'Best for gigantic / record': 'Highest published Size modifier among supported matches.',
    'Best for normal rarity cleanup': 'Highest published Likelihood item modifier among supported matches.',
    'Best for albino': 'Highest published Likelihood item modifier among supported matches.',
    'Best for melanistic': 'Highest published Likelihood item modifier among supported matches.',
    'Best for trophy': 'Highest published Likelihood item modifier among supported matches.',
    'Best balance': 'Direct species/group match within 15 points of the highest published Likelihood, then the fastest Bite Speed.',
    'Fastest raw bites': 'Highest raw published Bite Speed among supported matches.',
    'Highest likelihood': 'Highest published Likelihood item modifier among supported matches.',
    'Biggest size bonus': 'Highest published Size modifier among supported matches.',
    'Best target match': 'Strongest official species, group, location, or water targeting evidence.',
    'Strong alternative': 'Another supported option worth using when the category winners are unavailable.'
  };

  function recommendBaits(data, fish, association, goal, limit = 6) {
    const candidates = rankBaits(data, fish, association).flatMap(item => {
      const profiles = parseEffectProfiles(item.bait, fish, association);
      return profiles.map((profile, profileIndex) => ({
        ...item,
        candidateId: `${item.bait.id}::${profile.label || `default-${profileIndex}`}`,
        profile: profile.label,
        rank: profile.matchRank,
        evidence: profile.evidence,
        metrics: {
          biteSpeed: { value: profile.biteSpeed },
          likelihood: { value: profile.likelihood },
          size: { value: profile.size }
        },
        reasons: []
      }));
    });
    if (!candidates.length) return [];

    const balanced = bestBalance(candidates);
    const goalConfig = goal === 'gigantic'
        ? { key: 'size', label: 'Best for gigantic / record', requirePublished: true }
        : { key: 'likelihood', label: `Best for ${goal === 'normal' ? 'normal rarity cleanup' : goal}`, requirePublished: true };

    const ordered = [];
    const selected = new Map();
    const add = (item, reason) => {
      if (!item) return;
      const existing = selected.get(item.candidateId);
      if (existing) {
        if (!existing.reasons.includes(reason)) existing.reasons.push(reason);
        return;
      }
      item.reasons.push(reason);
      selected.set(item.candidateId, item);
      ordered.push(item);
    };

    add(goal === 'money' ? balanced : bestBy(candidates, goalConfig.key, goalConfig.requirePublished) || candidates[0], goal === 'money' ? 'Best for money / throughput' : goalConfig.label);
    add(balanced, 'Best balance');
    add(bestBy(candidates, 'biteSpeed'), 'Fastest raw bites');
    add(bestBy(candidates, 'likelihood', true), 'Highest likelihood');
    add(bestBy(candidates, 'size', true), 'Biggest size bonus');
    add([...candidates].sort((a, b) => b.rank - a.rank || a.bait.name.localeCompare(b.bait.name))[0], 'Best target match');

    const remaining = candidates.filter(item => !selected.has(item.candidateId)).sort((a, b) =>
      b.rank - a.rank || metricScore(b, goalConfig.key) - metricScore(a, goalConfig.key) || a.bait.name.localeCompare(b.bait.name)
    );
    remaining.forEach(item => add(item, 'Strong alternative'));

    return ordered.slice(0, Math.max(0, limit)).map(item => ({
      ...item,
      why: [...new Set(item.reasons.map(reason => reasonCopy[reason]).filter(Boolean))].join(' '),
      caveat: item.rank <= 2 && item.metrics.likelihood.value == null
        ? `Broad ${item.rank === 1 ? association.water : association.locationName} match — faster bites, but no published Likelihood boost for ${fish.name}.`
        : ''
    }));
  }

  function forFish(data, fish, locationId, goal) {
    const association = fish.locations.find(location => location.locationId === locationId) || fish.locations[0];
    if (!association) return [];
    const waterGear = association.water === 'Freshwater' ? "Branwell's Badwater pole + reel" : 'Gulftide Surf pole + reel';
    const calibrations = {
      normal: 'Elite Luck calibration', gigantic: 'Ultra Scale calibration', albino: 'Ivory variant calibration', melanistic: 'Onyx variant calibration', trophy: 'Gold variant calibration', money: 'Titanium Money or Pro Speed calibration'
    };
    const priorities = {
      normal: 'prioritize Luck and the exact-location pet’s Location Luck',
      gigantic: 'prioritize Scale, exact-location Scale, size rolls, and a serious supercharge',
      albino: 'run one coordinated Albino build and the Ivory Amulet if owned',
      melanistic: 'run one coordinated Melanistic build and the Onyx Amulet if owned',
      trophy: 'run one coordinated Trophy build and the Midas Amulet if owned',
      money: 'measure catches and net money per hour; keep broad throughput high'
    };
    const line = goal === 'gigantic' ? "Use Wade's Giant Line when its live tooltip beats your general line; carry a spare" : 'Use the strongest fully effective matching line you currently own';
    return [
      { title: 'Water-matched base', text: `${waterGear}. Check the live Power gate before buying or crafting; partial effectiveness can erase the paper upgrade.`, source: 'Current pole/reel and Power rules' },
      { title: 'Calibration', text: `${calibrations[goal] || calibrations.normal}. Do not continually overwrite one X part; endgame uses job-specific copies.`, source: 'Current Calibrator ranges' },
      { title: 'Armor', text: `Wear ${association.climate} armor. For ${association.group || 'this fish'}, ${priorities[goal] || priorities.normal}.`, source: 'Location climate + armor roll rules' },
      { title: 'Pet', text: `Use the ${data.locations.find(location => location.id === association.locationId)?.pet || 'exact-location pet'} at ${association.locationName}; compare its location stats before substituting a climate-only pet.`, source: 'Official location pet + pet-stat rules' },
      { title: 'Line', text: line, source: 'Current line table and record protocol' },
      { title: 'Bait', text: 'Use the highest-ranked official direct group/species match below. “Likelihood” is an item modifier, not a published exact probability for this fish.', source: 'Official tacklebox effect text' }
    ];
  }

  return { rankBaits, parseEffectProfiles, recommendBaits, forFish };
});
