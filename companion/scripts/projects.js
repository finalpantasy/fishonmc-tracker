(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FishOnProjects = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const catalog = [
    {
      id: 'catch-collector', name: 'FishOn Catch Collector', kind: 'Client mod', version: '0.4.1', status: 'Tracker companion',
      description: 'Records privacy-bounded personal catches and adds catchbook statistics used by the Tracker.',
      download: 'downloads/fishon-catch-collector-0.4.1.jar'
    },
    {
      id: 'fish-scale', name: 'FishOn Fish Scale', kind: 'Client mod', version: '0.2.0', status: 'Release',
      description: 'Renders caught fish at their recorded physical length while keeping inventory icons readable.',
      download: 'downloads/fishon-fish-scale-0.2.0.jar',
      repository: 'https://github.com/finalpantasy/fishon-fish-scale'
    },
    {
      id: 'standing-camera', name: 'FishOn Standing Camera', kind: 'Client mod', version: '1.0.1', status: 'Release',
      description: 'Keeps the first-person camera upright while FishOnMC still receives the real Sneak input.',
      download: 'downloads/fishon-standing-camera-1.0.1.jar',
      repository: 'https://github.com/finalpantasy/fishon-standing-camera'
    },
    {
      id: 'rarity-markers', name: 'FishOn Rarity Markers', kind: 'Client mod', version: '0.1.2', status: 'Release',
      description: 'Adds compact rarity silhouettes to FishOnMC inventory items without changing item data.',
      download: 'downloads/fishon-rarity-markers-0.1.2.jar'
    },
    {
      id: 'hud-normalizer', name: 'FishOn HUD Normalizer', kind: 'Client mod', version: '1.0.6', status: 'Release',
      description: 'Rendering-only cleanup for the fishing HUD with no input, packet, or gameplay automation.',
      download: 'downloads/fishon-hud-normalizer-1.0.6.jar'
    },
    {
      id: 'armor-visuals', name: 'FishOn Armor Visuals', kind: 'Client mod', version: '0.1.0-alpha.1', status: 'Alpha',
      description: 'Client-side armor presentation for the Rustic Fantasy visual suite. This build is experimental.',
      download: 'downloads/fishon-armor-visuals-0.1.0-alpha.1.jar'
    },
    {
      id: 'rustic-fish', name: 'Rustic Fantasy 128 — Fish Only', kind: 'Resource pack', version: '3.0.0-beta.3', status: 'Beta',
      description: 'The complete high-resolution fish-art replacement used throughout this Tracker.',
      download: 'downloads/fishonmc-rustic-fantasy-128-fish-only-3.0.0-beta.3.zip',
      repository: 'https://github.com/finalpantasy/fishonmc-rustic-fantasy-128'
    },
    {
      id: 'rustic-items-gear', name: 'Rustic Fantasy 128 — Items & Gear', kind: 'Resource pack', version: '1.0.0-beta.3', status: 'Beta',
      description: 'High-resolution bait, lure, rod, reel, line, box, pet-equipment, and technology icons.',
      download: 'downloads/fishonmc-rustic-fantasy-128-items-gear-icons-only-1.0.0-beta.3.zip'
    },
    {
      id: 'rustic-armor', name: 'Rustic Fantasy Armor — Complete', kind: 'Resource pack', version: '1.0.0', status: 'Release',
      description: 'The complete Rustic Fantasy armor texture layer for the FishOnMC visual suite.',
      download: 'downloads/fishonmc-rustic-fantasy-armor-complete-1.0.0.zip'
    },
    {
      id: 'hyperlegible-ui', name: 'FishOnMC Hyperlegible UI', kind: 'Resource pack', version: '1', status: 'Release',
      description: 'A higher-readability interface and font treatment for FishOnMC information displays.',
      download: 'downloads/fishonmc-hyperlegible-ui-v1.zip'
    },
    {
      id: 'realistic-splashes', name: 'Realistic Fishing Splashes', kind: 'Resource pack', version: '1.0.0', status: 'Release',
      description: 'A restrained water-particle replacement for more natural fishing splashes.',
      download: 'downloads/fishonmc-realistic-fishing-splashes-1.0.0.zip'
    }
  ].map(project => Object.freeze(project));

  return { catalog: Object.freeze(catalog) };
});
