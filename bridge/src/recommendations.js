const SUPPORTED_ACTIONS = new Set(['open-tab', 'open-guide-mission', 'open-location']);

function remaining(quest) {
  return Math.max(0, Number(quest.target || 0) - Number(quest.current || 0));
}

export function buildRecommendations({ quests = [] } = {}, { publicMode = false } = {}) {
  const active = Array.isArray(quests)
    ? quests.filter(quest => quest && !quest.complete && Number.isFinite(Number(quest.current)) && Number.isFinite(Number(quest.target)))
    : [];
  if (active.length === 0) {
    if (publicMode) return [{
      id: 'open-tracker-progress',
      priority: 100,
      title: 'Review Everything Compendium progress',
      reason: 'No incomplete Extras quest is currently available, so review missing fish, sizes, variants, and combinations.',
      evidence: 'local progress',
      action: { type: 'open-tab', tab: 'progress' }
    }];
    return [{
      id: 'open-progression-guide',
      priority: 100,
      title: 'Open the progression guide',
      reason: 'No incomplete Extras quest is currently available, so use the sourced progression route.',
      evidence: 'published',
      action: { type: 'open-tab', tab: publicMode ? 'progress' : 'guide' }
    }];
  }
  return active
    .sort((a, b) => remaining(a) - remaining(b) || String(a.title).localeCompare(String(b.title)))
    .slice(0, 5)
    .map((quest, index) => ({
      id: `continue-${String(quest.id || index + 1).slice(0, 160)}`,
      priority: 10 + index,
      title: `Continue ${String(quest.title || 'active quest').slice(0, 160)}`,
      reason: `${Number(quest.current)} of ${Number(quest.target)} complete${quest.locationName ? ` at ${String(quest.locationName).slice(0, 120)}` : ''}.`,
      evidence: 'observed',
      action: { type: 'open-tab', tab: publicMode ? 'progress' : 'guide' }
    }))
    .filter(item => SUPPORTED_ACTIONS.has(item.action.type));
}
