import path from 'node:path';
import { access, readFile } from 'node:fs/promises';

function safeRelativePath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\')) throw new Error('Public asset paths must use normalized forward slashes.');
  const normalized = path.posix.normalize(value);
  if (normalized !== value || normalized.startsWith('../') || path.posix.isAbsolute(normalized)) throw new Error(`Unsafe public asset path: ${value}`);
  return normalized;
}

export async function loadPublicAssets({ companionRoot, manifestPath = path.join(companionRoot, 'public-assets.json') } = {}) {
  const root = path.resolve(companionRoot);
  const parsed = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('Public asset manifest must be an array.');
  const assets = new Map();
  for (const entry of parsed) {
    const relative = safeRelativePath(entry);
    const absolute = path.resolve(root, ...relative.split('/'));
    if (absolute !== root && !absolute.toLowerCase().startsWith(`${root.toLowerCase()}${path.sep}`)) throw new Error(`Public asset escapes companion root: ${relative}`);
    await access(absolute);
    assets.set(`/${relative}`, absolute);
  }
  if (!assets.has('/index.html')) throw new Error('Public asset manifest must include index.html.');
  return assets;
}
