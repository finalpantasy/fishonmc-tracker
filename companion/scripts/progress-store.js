(function (root, factory) {
  const completion = root.FishOnCompletionModel || (typeof require === 'function' ? require('./completion-model.js') : null);
  const api = factory(completion);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.ProgressStore = api.create(undefined, root.FISHON_APP_CONFIG?.progressStore || {});
  root.ProgressStoreFactory = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (completion) {
  'use strict';

  if (!completion) throw new Error('FishOn completion model is required.');
  const SCHEMA_VERSION = 5;
  const STORAGE_KEY = 'fishonmc-field-guide-progress-v5';
  const V4_STORAGE_KEY = 'fishonmc-field-guide-progress-v4';
  const V3_STORAGE_KEY = 'fishonmc-field-guide-progress-v3';
  const V2_STORAGE_KEY = 'fishonmc-field-guide-progress-v2';
  const LEGACY_STORAGE_KEY = 'fishonmc-field-guide-progress-v1';
  const MAX_CATCHES_PER_ENTRY = 2000;
  const booleanFields = ['normal', 'gigantic', 'albino', 'melanistic', 'trophy', 'fabled'];
  const catchVariants = new Set(booleanFields);
  const sizeTiers = new Set(['baby', 'juvenile', 'adult', 'large', 'gigantic']);
  const dayPhases = new Set(['dawn', 'day', 'dusk', 'night']);
  const weatherTypes = new Set(['clear', 'rain', 'thunder']);
  const evidenceTypes = new Set(['imported', 'manual', 'observed']);
  const evidencePriority = { imported: 1, manual: 2, observed: 3 };
  const guideGoals = new Set(['progress', 'money', 'collection', 'power', 'variants', 'completion']);
  const guideModes = new Set(['route', 'journey', 'systems', 'manual']);

  function blankGuide() {
    return {
      completedSteps: {},
      profile: { level: 0, locationId: 'cypress-lake', goal: 'progress' },
      lastMissionId: 'install-join',
      lastMode: 'route'
    };
  }

  function blank(includeGuide = true) {
    const value = { schemaVersion: SCHEMA_VERSION, updatedAt: new Date(0).toISOString(), entries: {}, orphanedEntries: {} };
    if (includeGuide) value.guide = blankGuide();
    return value;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function safeNumber(value) {
    if (value === '' || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }

  function safeTimestamp(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  function boundedText(value, length = 120) {
    return String(value ?? '').trim().slice(0, length);
  }

  function boundedArmor(value) {
    const normalized = Array.isArray(value) ? value.map(item => boundedText(item)).filter(Boolean).join(' • ') : value;
    return boundedText(normalized);
  }

  function optionalChoice(value, choices, fieldName) {
    if (value === '' || value === null || value === undefined) return null;
    const normalized = String(value).toLowerCase();
    if (!choices.has(normalized)) throw new TypeError(`Invalid catch ${fieldName}.`);
    return normalized;
  }

  function sanitizeCatch(raw, { defaultId = null, now = () => new Date(), sourceVersion = SCHEMA_VERSION } = {}) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new TypeError('Invalid catch record.');
    const id = boundedText(raw.id || defaultId, 160);
    if (!id) throw new TypeError('Catch ID is required.');
    const variant = optionalChoice(raw.variant, catchVariants, 'variant');
    if (!variant) throw new TypeError('Catch variant is required.');
    const caughtAt = safeTimestamp(raw.caughtAt);
    if (raw.caughtAt && !caughtAt) throw new TypeError('Invalid catch timestamp.');
    const createdAt = safeTimestamp(raw.createdAt) || new Date(now()).toISOString();
    const updatedAt = safeTimestamp(raw.updatedAt) || createdAt;
    const numberFields = ['weightLb', 'lengthIn', 'valueCoins', 'xp', 'luckBonus', 'variantBonus', 'scaleBonus', 'biteSpeedBonus', 'moneyBonus', 'power', 'fightSeconds'];
    const record = {
      id,
      caughtAt,
      sessionTag: boundedText(raw.sessionTag),
      variant,
      sizeTier: optionalChoice(raw.sizeTier, sizeTiers, 'size tier'),
      baitId: boundedText(raw.baitId, 180),
      baitText: boundedText(raw.baitText),
      rod: boundedText(raw.rod),
      reel: boundedText(raw.reel),
      line: boundedText(raw.line),
      armor: boundedArmor(raw.armor),
      pet: boundedText(raw.pet),
      subLocation: boundedText(raw.subLocation),
      temperature: boundedText(raw.temperature),
      observedRarity: boundedText(raw.observedRarity, 40).toLowerCase(),
      dayPhase: optionalChoice(raw.dayPhase, dayPhases, 'day phase'),
      weather: optionalChoice(raw.weather, weatherTypes, 'weather'),
      eventCatch: Boolean(raw.eventCatch),
      tournamentCatch: Boolean(raw.tournamentCatch),
      questCatch: Boolean(raw.questCatch),
      source: evidenceTypes.has(raw.source) ? raw.source : sourceVersion < 4 ? 'imported' : 'manual',
      notes: String(raw.notes ?? '').slice(0, 500),
      createdAt,
      updatedAt
    };
    for (const field of numberFields) record[field] = safeNumber(raw[field]);
    return record;
  }

  function dedupeCatches(catches) {
    const byId = new Map();
    for (const record of catches) {
      const current = byId.get(record.id);
      if (!current || String(record.updatedAt).localeCompare(String(current.updatedAt)) >= 0) byId.set(record.id, record);
    }
    return [...byId.values()].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || a.id.localeCompare(b.id));
  }

  function sanitizeEvidence(raw, fallbackType = null) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const type = evidenceTypes.has(source.type) ? source.type : fallbackType;
    if (!type) return null;
    return {
      type,
      firstSeenAt: safeTimestamp(source.firstSeenAt),
      lastSeenAt: safeTimestamp(source.lastSeenAt),
      eventId: source.eventId == null ? null : String(source.eventId).slice(0, 200)
    };
  }

  function mergeEvidence(first, second) {
    const a = sanitizeEvidence(first);
    const b = sanitizeEvidence(second);
    if (!a) return b;
    if (!b) return a;
    const stronger = evidencePriority[b.type] > evidencePriority[a.type] ? b : a;
    const firstTimes = [a.firstSeenAt, b.firstSeenAt].filter(Boolean).sort();
    const lastTimes = [a.lastSeenAt, b.lastSeenAt].filter(Boolean).sort();
    return {
      type: stronger.type,
      firstSeenAt: firstTimes[0] || null,
      lastSeenAt: lastTimes.at(-1) || null,
      eventId: stronger.eventId || a.eventId || b.eventId || null
    };
  }

  function sanitizeFlagMap(raw, keys) {
    return Object.fromEntries(keys.map(key => [key, Boolean(raw?.[key])]));
  }

  function legacyCompletion(raw) {
    const state = completion.blankCompletion();
    state.caught = Boolean(raw.normal);
    state.sizes.gigantic = Boolean(raw.gigantic);
    for (const variant of completion.variants) state.variants[variant] = Boolean(raw[variant]);
    return state;
  }

  function sanitizeCompletion(raw, sourceVersion) {
    const source = sourceVersion >= 5 && raw?.completion ? raw.completion : legacyCompletion(raw || {});
    return {
      caught: Boolean(source.caught),
      sizes: sanitizeFlagMap(source.sizes, completion.sizes),
      variants: sanitizeFlagMap(source.variants, completion.variants),
      combinations: sanitizeFlagMap(source.combinations, completion.allCombinationKeys)
    };
  }

  function catchCompletionPatch(record) {
    const derived = completion.patchFromCatch(record);
    return {
      caught: true,
      sizes: Object.fromEntries(derived.sizes.map(key => [key, true])),
      variants: Object.fromEntries(derived.variants.map(key => [key, true])),
      combinations: Object.fromEntries(derived.combinations.map(key => [key, true]))
    };
  }

  function applyCompletionPatch(current, patch = {}) {
    const next = clone(current || completion.blankCompletion());
    if (patch.caught !== undefined) next.caught = Boolean(patch.caught);
    for (const [section, keys] of [['sizes', completion.sizes], ['variants', completion.variants], ['combinations', completion.allCombinationKeys]]) {
      for (const [key, value] of Object.entries(patch[section] || {})) {
        if (!keys.includes(key)) throw new TypeError(`Invalid completion objective: ${key}.`);
        next[section][key] = Boolean(value);
      }
    }
    return next;
  }

  function sanitizeEntry(key, raw, sourceVersion = SCHEMA_VERSION, dependencies = {}) {
    if (!raw || typeof raw !== 'object') return null;
    const [fallbackFishId, fallbackLocationId] = String(key).split('::');
    const fishId = String(raw.fishId || fallbackFishId || '').trim();
    const locationId = String(raw.locationId || fallbackLocationId || '').trim();
    if (!fishId || !locationId) return null;
    const entry = { fishId, locationId };
    entry.completion = sanitizeCompletion(raw, sourceVersion);
    entry.evidence = {};
    for (const field of booleanFields) {
      const fallbackType = raw[field] ? 'manual' : null;
      entry.evidence[field] = sanitizeEvidence(raw.evidence?.[field], sourceVersion < 3 && raw[field] ? 'manual' : fallbackType);
      entry[field] = Boolean(raw[field]) || Boolean(entry.evidence[field]);
    }
    entry.bestWeightLb = safeNumber(raw.bestWeightLb);
    entry.bestLengthIn = safeNumber(raw.bestLengthIn);
    entry.notes = String(raw.notes ?? '').slice(0, 2000);
    if (raw.catches !== undefined && !Array.isArray(raw.catches)) throw new TypeError('Catch history must be an array.');
    if ((raw.catches?.length || 0) > MAX_CATCHES_PER_ENTRY) throw new TypeError(`Catch history exceeds ${MAX_CATCHES_PER_ENTRY} records.`);
    entry.catches = dedupeCatches((raw.catches || []).map(record => sanitizeCatch(record, { ...dependencies, sourceVersion })));
    if (sourceVersion < 5) {
      for (const record of entry.catches) entry.completion = applyCompletionPatch(entry.completion, catchCompletionPatch(record));
    }
    entry.normal = entry.completion.caught;
    entry.gigantic = entry.completion.sizes.gigantic;
    for (const variant of completion.variants) entry[variant] = entry.completion.variants[variant];
    entry.updatedAt = typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString();
    return entry;
  }

  function safeId(value, fallback, maxLength = 100) {
    const normalized = String(value ?? '').trim().slice(0, maxLength);
    return normalized || fallback;
  }

  function sanitizeGuide(raw) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const profile = source.profile && typeof source.profile === 'object' ? source.profile : {};
    const parsedLevel = Number(profile.level);
    const level = Number.isFinite(parsedLevel) ? Math.min(999, Math.max(0, Math.floor(parsedLevel))) : 0;
    const goal = guideGoals.has(profile.goal) ? profile.goal : 'progress';
    const locationId = safeId(profile.locationId, 'cypress-lake');
    const completedSteps = {};
    if (source.completedSteps && typeof source.completedSteps === 'object' && !Array.isArray(source.completedSteps)) {
      for (const [key, value] of Object.entries(source.completedSteps)) {
        const safeKey = safeId(key, '', 220);
        if (safeKey && value) completedSteps[safeKey] = true;
      }
    }
    return {
      completedSteps,
      profile: { level, locationId, goal },
      lastMissionId: safeId(source.lastMissionId, 'install-join'),
      lastMode: guideModes.has(source.lastMode) ? source.lastMode : 'route'
    };
  }

  function validate(raw, dependencies = {}) {
    const includeGuide = dependencies.includeGuide !== false;
    if (!raw || typeof raw !== 'object') return { ok: false, error: 'Backup is not a JSON object.' };
    if (![1, 2, 3, 4, SCHEMA_VERSION].includes(raw.schemaVersion)) return { ok: false, error: `Unsupported backup version: ${raw.schemaVersion ?? 'missing'}.` };
    const source = raw;
    if (!source.entries || typeof source.entries !== 'object' || Array.isArray(source.entries)) return { ok: false, error: 'Backup has no valid entries object.' };
    const next = blank(includeGuide);
    for (const [key, value] of Object.entries(source.entries)) {
      let entry;
      try { entry = sanitizeEntry(key, value, source.schemaVersion); }
      catch (error) { return { ok: false, error: `Invalid progress entry: ${key}. ${error.message}` }; }
      if (!entry) return { ok: false, error: `Invalid progress entry: ${key}.` };
      next.entries[`${entry.fishId}::${entry.locationId}`] = entry;
    }
    if (includeGuide) next.guide = source.schemaVersion === 1 ? blankGuide() : sanitizeGuide(source.guide);
    if (source.orphanedEntries && typeof source.orphanedEntries === 'object') next.orphanedEntries = clone(source.orphanedEntries);
    next.updatedAt = typeof source.updatedAt === 'string' ? source.updatedAt : new Date().toISOString();
    return { ok: true, value: next };
  }

  function create(storageOverride, dependencies = {}) {
    const storageKey = String(dependencies.storageKey || STORAGE_KEY);
    const includeGuide = dependencies.includeGuide !== false;
    const legacyStorageKeys = [...new Set((dependencies.legacyStorageKeys || [V4_STORAGE_KEY, V3_STORAGE_KEY, V2_STORAGE_KEY, LEGACY_STORAGE_KEY]).map(String))];
    let memory = blank(includeGuide);
    const now = typeof dependencies.now === 'function' ? dependencies.now : () => new Date();
    const idFactory = typeof dependencies.idFactory === 'function' ? dependencies.idFactory : () => {
      try { if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID(); } catch { /* Fall through. */ }
      return `catch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    };
    let storage = storageOverride;
    if (storage === undefined) {
      try { storage = typeof localStorage !== 'undefined' ? localStorage : null; } catch { storage = null; }
    }
    let persistenceAvailable = Boolean(storage);

    function persist() {
      memory.updatedAt = new Date().toISOString();
      if (!storage) return false;
      try {
        storage.setItem(storageKey, JSON.stringify(memory));
        persistenceAvailable = true;
        return true;
      } catch {
        persistenceAvailable = false;
        return false;
      }
    }

    function load() {
      if (!storage) return clone(memory);
      try {
        const candidates = [[storageKey, storage.getItem(storageKey)], ...legacyStorageKeys.map(key => [key, storage.getItem(key)])];
        for (const [key, raw] of candidates) {
          if (!raw) continue;
          try {
            const parsed = validate(JSON.parse(raw), { includeGuide });
            if (!parsed.ok) continue;
            memory = parsed.value;
            if (key !== storageKey) persist();
            return clone(memory);
          } catch {
            // A corrupt current save must not hide a still-valid legacy save.
          }
        }
      } catch {
        persistenceAvailable = false;
      }
      return clone(memory);
    }

    function get(fishId, locationId) {
      return clone(memory.entries[`${fishId}::${locationId}`] ?? null);
    }

    function updateFish(fishId, locationId, patch) {
      const key = `${fishId}::${locationId}`;
      const current = memory.entries[key] ?? sanitizeEntry(key, {}, SCHEMA_VERSION, { now });
      const patchEvidence = patch?.evidence && typeof patch.evidence === 'object' ? patch.evidence : {};
      const completionPatch = {};
      if (Object.prototype.hasOwnProperty.call(patch || {}, 'normal')) completionPatch.caught = patch.normal;
      if (Object.prototype.hasOwnProperty.call(patch || {}, 'gigantic')) completionPatch.sizes = { gigantic: patch.gigantic };
      for (const variant of completion.variants) {
        if (!Object.prototype.hasOwnProperty.call(patch || {}, variant)) continue;
        completionPatch.variants = { ...(completionPatch.variants || {}), [variant]: patch[variant] };
      }
      const merged = sanitizeEntry(key, {
        ...current,
        ...patch,
        completion: applyCompletionPatch(current.completion, completionPatch),
        evidence: { ...current.evidence, ...patchEvidence },
        fishId,
        locationId,
        updatedAt: new Date().toISOString()
      }, SCHEMA_VERSION, { now });
      for (const field of booleanFields) {
        if (!Object.prototype.hasOwnProperty.call(patch || {}, field)) continue;
        if (patch[field]) {
          merged[field] = true;
          merged.evidence[field] = mergeEvidence(current.evidence?.[field], sanitizeEvidence(patchEvidence[field], 'manual'));
        } else if (current.evidence?.[field]?.type === 'observed') {
          merged[field] = true;
          merged.evidence[field] = current.evidence[field];
        } else {
          merged[field] = false;
          merged.evidence[field] = null;
        }
      }
      memory.entries[key] = merged;
      persist();
      return clone(memory);
    }

    function updateCompletion(fishId, locationId, patch) {
      const key = `${fishId}::${locationId}`;
      const current = memory.entries[key] ?? sanitizeEntry(key, {}, SCHEMA_VERSION, { now });
      const nextCompletion = applyCompletionPatch(current.completion, patch);
      const merged = sanitizeEntry(key, {
        ...current,
        completion: nextCompletion,
        fishId,
        locationId,
        updatedAt: new Date(now()).toISOString()
      }, SCHEMA_VERSION, { now });
      memory.entries[key] = merged;
      persist();
      return clone(merged);
    }

    function addCatch(fishId, locationId, input) {
      const key = `${fishId}::${locationId}`;
      const current = memory.entries[key] ?? sanitizeEntry(key, {}, SCHEMA_VERSION, { now });
      if (current.catches.length >= MAX_CATCHES_PER_ENTRY) throw new RangeError(`Catch history is limited to ${MAX_CATCHES_PER_ENTRY} records per fish and location.`);
      let generatedId = boundedText(input?.id || idFactory(), 160);
      while (current.catches.some(record => record.id === generatedId)) generatedId = boundedText(idFactory(), 160);
      const timestamp = new Date(now()).toISOString();
      const record = sanitizeCatch({ ...input, id: generatedId, createdAt: input?.createdAt || timestamp, updatedAt: input?.updatedAt || timestamp }, { now });
      const evidence = mergeEvidence(current.evidence?.[record.variant], { type: record.source === 'observed' ? 'observed' : 'manual', firstSeenAt: record.caughtAt || timestamp, lastSeenAt: record.caughtAt || timestamp, eventId: record.id });
      const merged = sanitizeEntry(key, {
        ...current,
        completion: applyCompletionPatch(current.completion, catchCompletionPatch(record)),
        [record.variant]: true,
        evidence: { ...current.evidence, [record.variant]: evidence },
        catches: [...current.catches, record],
        updatedAt: timestamp
      }, SCHEMA_VERSION, { now });
      memory.entries[key] = merged;
      persist();
      return clone(merged);
    }

    function updateCatch(fishId, locationId, catchId, patch) {
      const key = `${fishId}::${locationId}`;
      const current = memory.entries[key];
      if (!current) throw new Error('Catch entry was not found.');
      const index = current.catches.findIndex(record => record.id === catchId);
      if (index < 0) throw new Error('Catch record was not found.');
      const previous = current.catches[index];
      const timestamp = new Date(now()).toISOString();
      const record = sanitizeCatch({ ...previous, ...patch, id: previous.id, createdAt: previous.createdAt, updatedAt: timestamp }, { now });
      const catches = [...current.catches];
      catches[index] = record;
      const evidence = mergeEvidence(current.evidence?.[record.variant], { type: record.source === 'observed' ? 'observed' : 'manual', firstSeenAt: record.caughtAt || previous.createdAt, lastSeenAt: record.caughtAt || timestamp, eventId: record.id });
      const merged = sanitizeEntry(key, {
        ...current,
        completion: applyCompletionPatch(current.completion, catchCompletionPatch(record)),
        [record.variant]: true,
        evidence: { ...current.evidence, [record.variant]: evidence },
        catches,
        updatedAt: timestamp
      }, SCHEMA_VERSION, { now });
      memory.entries[key] = merged;
      persist();
      return clone(merged);
    }

    function deleteCatch(fishId, locationId, catchId) {
      const key = `${fishId}::${locationId}`;
      const current = memory.entries[key];
      if (!current) throw new Error('Catch entry was not found.');
      const catches = current.catches.filter(record => record.id !== catchId);
      if (catches.length === current.catches.length) throw new Error('Catch record was not found.');
      const merged = sanitizeEntry(key, { ...current, catches, updatedAt: new Date(now()).toISOString() }, SCHEMA_VERSION, { now });
      memory.entries[key] = merged;
      persist();
      return clone(merged);
    }

    function getGuide() {
      return clone(memory.guide);
    }

    function updateGuideProfile(patch) {
      memory.guide = sanitizeGuide({ ...memory.guide, profile: { ...memory.guide.profile, ...patch } });
      persist();
      return clone(memory.guide);
    }

    function setGuideMode(mode) {
      memory.guide = sanitizeGuide({ ...memory.guide, lastMode: mode });
      persist();
      return memory.guide.lastMode;
    }

    function setLastMission(missionId) {
      memory.guide = sanitizeGuide({ ...memory.guide, lastMissionId: missionId });
      persist();
      return memory.guide.lastMissionId;
    }

    function setGuideStep(missionId, stepId, complete) {
      const key = `${safeId(missionId, '', 100)}::${safeId(stepId, '', 100)}`;
      if (key === '::') return clone(memory.guide);
      const completedSteps = { ...memory.guide.completedSteps };
      if (complete) completedSteps[key] = true;
      else delete completedSteps[key];
      memory.guide = sanitizeGuide({ ...memory.guide, completedSteps });
      persist();
      return clone(memory.guide);
    }

    function exportJson() {
      const output = clone(memory);
      if (!includeGuide) delete output.guide;
      return JSON.stringify(output, null, 2);
    }

    function importJson(text) {
      let raw;
      try { raw = JSON.parse(text); } catch { return { ok: false, error: 'The selected file is not valid JSON.' }; }
      const result = validate(raw, { includeGuide });
      if (!result.ok) return result;
      const imported = result.value;
      const merged = clone(memory);
      for (const [key, incoming] of Object.entries(imported.entries)) {
        const current = merged.entries[key];
        if (!current) { merged.entries[key] = incoming; continue; }
        const next = sanitizeEntry(key, current, SCHEMA_VERSION, { now });
        next.completion.caught = Boolean(current.completion?.caught || incoming.completion?.caught);
        for (const section of ['sizes', 'variants', 'combinations']) {
          for (const objective of Object.keys(next.completion[section])) next.completion[section][objective] = Boolean(current.completion?.[section]?.[objective] || incoming.completion?.[section]?.[objective]);
        }
        for (const field of booleanFields) {
          next.evidence[field] = mergeEvidence(current.evidence?.[field], incoming.evidence?.[field]);
          next[field] = Boolean(current[field] || incoming[field] || next.evidence[field]);
        }
        next.bestWeightLb = Math.max(current.bestWeightLb ?? 0, incoming.bestWeightLb ?? 0) || null;
        next.bestLengthIn = Math.max(current.bestLengthIn ?? 0, incoming.bestLengthIn ?? 0) || null;
        next.notes = current.notes || incoming.notes;
        next.catches = dedupeCatches([...(current.catches || []), ...(incoming.catches || [])]);
        next.updatedAt = [current.updatedAt, incoming.updatedAt].filter(Boolean).sort().at(-1) || new Date().toISOString();
        merged.entries[key] = sanitizeEntry(key, next, SCHEMA_VERSION, { now });
      }
      if (includeGuide) merged.guide = imported.guide;
      else delete merged.guide;
      merged.orphanedEntries = { ...merged.orphanedEntries, ...imported.orphanedEntries };
      memory = merged;
      persist();
      return { ok: true, value: clone(memory) };
    }

    function reset() {
      memory = blank(includeGuide);
      if (storage) {
        try {
          storage.removeItem(storageKey);
          for (const key of legacyStorageKeys) storage.removeItem(key);
        } catch { persistenceAvailable = false; }
      }
      return clone(memory);
    }

    function status() {
      return { persistenceAvailable, storageKey, schemaVersion: SCHEMA_VERSION };
    }

    load();
    return { load, get, updateFish, updateCompletion, addCatch, updateCatch, deleteCatch, getGuide, updateGuideProfile, setGuideMode, setLastMission, setGuideStep, exportJson, importJson, reset, status, validate };
  }

  return { create, validate, blank, blankGuide, sanitizeCatch, STORAGE_KEY, V4_STORAGE_KEY, V3_STORAGE_KEY, V2_STORAGE_KEY, LEGACY_STORAGE_KEY, SCHEMA_VERSION };
});
