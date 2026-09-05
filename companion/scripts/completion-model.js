(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FishOnCompletionModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const sizes = Object.freeze(['baby', 'juvenile', 'adult', 'large', 'gigantic']);
  const variants = Object.freeze(['albino', 'melanistic', 'trophy', 'fabled']);
  const combinationKey = (size, variant) => `${size}:${variant}`;
  const allCombinationKeys = Object.freeze(sizes.flatMap(size => variants.map(variant => combinationKey(size, variant))));
  const blankFlags = values => Object.fromEntries(values.map(value => [value, false]));

  function blankCompletion() {
    return {
      caught: false,
      sizes: blankFlags(sizes),
      variants: blankFlags(variants),
      combinations: blankFlags(allCombinationKeys)
    };
  }

  function availableFlags(raw, keys) {
    return Object.fromEntries(keys.map(key => [key, raw?.[key] !== false]));
  }

  function sanitizeAvailability(raw = {}) {
    return {
      caught: raw.caught !== false,
      sizes: availableFlags(raw.sizes, sizes),
      variants: availableFlags(raw.variants, variants),
      combinations: availableFlags(raw.combinations, allCombinationKeys)
    };
  }

  function patchFromCatch(record = {}) {
    const size = sizes.includes(record.sizeTier) ? record.sizeTier : record.variant === 'gigantic' ? 'gigantic' : null;
    const variant = variants.includes(record.variant) ? record.variant : null;
    return {
      caught: true,
      sizes: size ? [size] : [],
      variants: variant ? [variant] : [],
      combinations: size && variant ? [combinationKey(size, variant)] : []
    };
  }

  function section(keys, flags, attainable) {
    const items = Object.fromEntries(keys.map(key => [key, {
      complete: Boolean(flags?.[key]),
      attainable: attainable[key]
    }]));
    const possible = Object.values(items).filter(item => item.attainable);
    return { items, done: possible.filter(item => item.complete).length, total: possible.length };
  }

  function objectives(entry = {}, rawAvailability = {}) {
    const availability = sanitizeAvailability(rawAvailability);
    const state = entry.completion || blankCompletion();
    if (!entry.completion) {
      state.caught = Boolean(entry.normal);
      state.sizes.gigantic = Boolean(entry.gigantic);
      for (const variant of variants) state.variants[variant] = Boolean(entry[variant]);
    }
    const caught = { complete: Boolean(state.caught), attainable: availability.caught };
    const sizeSection = section(sizes, state.sizes, availability.sizes);
    const variantSection = section(variants, state.variants, availability.variants);
    const combinationSection = section(allCombinationKeys, state.combinations, availability.combinations);
    return {
      caught,
      sizes: sizeSection,
      variants: variantSection,
      combinations: combinationSection,
      done: (caught.complete && caught.attainable ? 1 : 0) + sizeSection.done + variantSection.done + combinationSection.done,
      total: (caught.attainable ? 1 : 0) + sizeSection.total + variantSection.total + combinationSection.total
    };
  }

  return { sizes, variants, combinationKey, allCombinationKeys, blankCompletion, sanitizeAvailability, objectives, patchFromCatch };
});
