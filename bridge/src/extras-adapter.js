import path from 'node:path';
import { access, readdir } from 'node:fs/promises';
import { fingerprintPath } from './config.js';
import { SourceReadError } from './safe-json.js';

const SOURCE_FILES = Object.freeze({
  'extras-profile': 'profile.json',
  'extras-quest': 'quest.json',
  'extras-stats': 'stats.json'
});
const KNOWN_VERSIONS = Object.freeze({
  'extras-profile': new Set(['0.5']),
  'extras-quest': new Set(['0.2']),
  'extras-stats': new Set(['0.3'])
});

class ProfileSelectionError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ProfileSelectionError';
    this.code = code;
  }
}

const safeBoolean = value => typeof value === 'boolean' ? value : null;
const safeInteger = value => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : null;
const slug = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'unknown';
const titleCase = value => String(value || '').replace(/(^|\s|[-_])\p{L}/gu, match => match.toUpperCase()).replaceAll('_', ' ');

function directChild(root, candidate) {
  return path.dirname(path.resolve(candidate)).toLowerCase() === path.resolve(root).toLowerCase();
}

async function hasExpectedFile(directory) {
  for (const fileName of Object.values(SOURCE_FILES)) {
    try { await access(path.join(directory, fileName)); return true; }
    catch { /* Try the next expected file. */ }
  }
  return false;
}

function amountMap(raw) {
  const output = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return output;
  for (const [key, value] of Object.entries(raw)) {
    const amount = safeInteger(value?.amount);
    if (amount !== null) output[key] = amount;
  }
  return output;
}

function sumAmounts(raw) {
  return Object.values(amountMap(raw)).reduce((total, value) => total + value, 0);
}

function normalizeProfile(raw) {
  return {
    activePetSlot: safeInteger(raw?.activePetSlot),
    tournamentContribution: safeBoolean(raw?.tournamentContribution),
    hasImportedStats: safeBoolean(raw?.hasImportedStats),
    hasImportedCrew: safeBoolean(raw?.hasImportedCrew),
    isInCrewChat: safeBoolean(raw?.isInCrewChat),
    level: null,
    locationId: null,
    wallet: null,
    catchRate: null
  };
}

function normalizeQuests(raw) {
  const quests = [];
  if (!raw?.questList || typeof raw.questList !== 'object' || Array.isArray(raw.questList)) return quests;
  for (const [locationName, goals] of Object.entries(raw.questList)) {
    if (!Array.isArray(goals)) continue;
    goals.forEach((goal, index) => {
      const current = safeInteger(goal?.current);
      const target = safeInteger(goal?.max);
      const goalName = String(goal?.goal || '').trim();
      if (!goalName || current === null || target === null) return;
      quests.push({
        id: `${slug(locationName)}-${slug(goalName)}-${index + 1}`,
        locationName: String(locationName).slice(0, 120),
        goal: goalName.slice(0, 120),
        title: `${String(locationName).slice(0, 120)} — ${titleCase(goalName).slice(0, 120)}`,
        current,
        target,
        complete: current >= target
      });
    });
  }
  return quests;
}

function normalizeStats(raw) {
  if (!raw || typeof raw !== 'object') return null;
  return {
    totals: {
      fish: safeInteger(raw.fishTotal),
      pet: safeInteger(raw.petTotal),
      item: sumAmounts(raw.itemData),
      questPet: safeInteger(raw.questPetTotal) ?? sumAmounts(raw.questPetData),
      questItem: sumAmounts(raw.questItemData)
    },
    fish: {
      bySize: amountMap(raw.fishData?.size),
      byVariant: amountMap(raw.fishData?.variant),
      byRarity: amountMap(raw.fishData?.rarity)
    },
    pet: {
      byRating: amountMap(raw.petData?.rating),
      byRarity: amountMap(raw.petData?.rarity)
    },
    item: { byType: amountMap(raw.itemData) },
    questPet: { byType: amountMap(raw.questPetData) },
    questItem: { byType: amountMap(raw.questItemData) }
  };
}

function publicSource(kind, result, state = 'live') {
  return {
    kind,
    version: String(result?.value?.version ?? ''),
    state,
    modifiedAt: result?.source?.modifiedAt ?? null,
    size: result?.source?.size ?? null,
    redactedPath: `…/${SOURCE_FILES[kind]}`
  };
}

export function createExtrasAdapter({ dataRoot, selectedProfileDirectory = null, readJson, quarantine = null } = {}) {
  if (!path.isAbsolute(dataRoot || '')) throw new TypeError('Extras data root must be an absolute path.');
  if (typeof readJson !== 'function') throw new TypeError('An Extras JSON reader is required.');
  const root = path.resolve(dataRoot);

  async function resolvePlayerDirectory() {
    if (selectedProfileDirectory) {
      const selected = path.resolve(selectedProfileDirectory);
      if (!directChild(root, selected)) throw new ProfileSelectionError('INVALID_PROFILE_SELECTION', 'Selected profile must be a direct child of the Extras data root.');
      if (!await hasExpectedFile(selected)) throw new ProfileSelectionError('PROFILE_NOT_FOUND', 'The selected Extras profile has no recognized data files.');
      return selected;
    }
    let entries;
    try { entries = await readdir(root, { withFileTypes: true }); }
    catch (error) {
      if (error.code === 'ENOENT') throw new ProfileSelectionError('PROFILE_NOT_FOUND', 'No FishOnMC Extras profile data is available.');
      throw error;
    }
    const candidates = [];
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidate = path.join(root, entry.name);
      if (await hasExpectedFile(candidate)) candidates.push(candidate);
    }
    if (candidates.length === 0) throw new ProfileSelectionError('PROFILE_NOT_FOUND', 'No FishOnMC Extras profile data is available.');
    if (candidates.length > 1) throw new ProfileSelectionError('PROFILE_SELECTION_REQUIRED', 'Multiple FishOnMC Extras profiles exist; select one explicitly.');
    return candidates[0];
  }

  async function readArea(profileDirectory, kind, warnings, sources) {
    try {
      const result = await readJson(path.join(profileDirectory, SOURCE_FILES[kind]));
      sources[kind] = publicSource(kind, result);
      const version = String(result.value?.version ?? '');
      if (!KNOWN_VERSIONS[kind].has(version)) {
        warnings.push({ code: 'UNKNOWN_SOURCE_VERSION', sourceKind: kind, message: `${kind} uses an unrecognized schema version.` });
      }
      return result.value;
    } catch (error) {
      const code = error instanceof SourceReadError ? error.publicCode : 'SOURCE_UNREADABLE';
      warnings.push({ code, sourceKind: kind, message: error.publicMessage || `The ${kind} source is unavailable.` });
      sources[kind] = { kind, version: null, state: code === 'SOURCE_MISSING' ? 'offline' : 'stale', modifiedAt: null, size: error.metadata?.byteLength ?? null, redactedPath: `…/${SOURCE_FILES[kind]}` };
      if (code === 'SOURCE_MALFORMED' && quarantine?.record) {
        await quarantine.record({
          sourceKind: kind,
          observedAt: new Date().toISOString(),
          byteLength: error.metadata?.byteLength ?? 0,
          contentHash: error.metadata?.contentHash,
          errorCode: code
        });
      }
      return null;
    }
  }

  async function readSnapshot() {
    const profileDirectory = await resolvePlayerDirectory();
    const warnings = [];
    const sources = {};
    const [profileRaw, questRaw, statsRaw] = await Promise.all([
      readArea(profileDirectory, 'extras-profile', warnings, sources),
      readArea(profileDirectory, 'extras-quest', warnings, sources),
      readArea(profileDirectory, 'extras-stats', warnings, sources)
    ]);
    return {
      observedAt: new Date().toISOString(),
      profileFingerprint: fingerprintPath(profileDirectory),
      profile: normalizeProfile(profileRaw),
      quests: normalizeQuests(questRaw),
      aggregateStats: normalizeStats(statsRaw),
      equipment: null,
      catches: null,
      sources,
      warnings
    };
  }

  return Object.freeze({ resolvePlayerDirectory, readSnapshot });
}
