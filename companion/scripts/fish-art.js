(function (root) {
  'use strict';

  const data = root.FISHON_DATA;
  if (!data?.fish) return;

  const variants = ['normal', 'albino', 'melanistic', 'trophy', 'fabled'];
  const aliases = { broadbarredspanishmackerel: 'broadbarredkingmackerel' };
  const slugFor = fish => {
    const derived = String(fish.imageFilename || fish.image?.split('/').pop() || '')
      .replace(/^fish_/i, '')
      .replace(/\.png$/i, '')
      .toLowerCase();
    return aliases[derived] || derived;
  };

  for (const fish of data.fish) {
    if (fish.artAvailable === false) {
      fish.officialImage = null;
      fish.rusticSlug = null;
      fish.variantImages = Object.fromEntries(variants.map(variant => [variant, fish.image]));
      continue;
    }
    const slug = slugFor(fish);
    if (!slug) continue;
    fish.officialImage = fish.image;
    fish.rusticSlug = slug;
    fish.variantImages = Object.fromEntries(variants.map(variant => [
      variant,
      `assets/fish-rustic-128/${variant}/${slug}.png`
    ]));
    fish.image = fish.variantImages.normal;
  }

  root.FishOnArt = { aliases, variants, slugFor };
})(window);
