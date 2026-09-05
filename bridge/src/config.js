import crypto from 'node:crypto';
import path from 'node:path';

export const DEFAULT_INSTANCE_PATH = '';
export const PORT_RANGE = Object.freeze([45831, 45839]);
export const LOOPBACK_HOST = '127.0.0.1';

export function canonicalizeWindowsPath(input) {
  if (typeof input !== 'string' || !input.trim()) throw new TypeError('Path is required.');
  let canonical = path.win32.resolve(input.trim()).replaceAll('/', '\\');
  if (!/^[a-zA-Z]:\\$/.test(canonical)) canonical = canonical.replace(/\\+$/, '');
  return canonical.toLowerCase();
}

export function fingerprintPath(input) {
  return crypto.createHash('sha256').update(canonicalizeWindowsPath(input), 'utf8').digest('hex').slice(0, 16);
}

function resolveSelectedProfile(extrasDataRoot, selectedProfileDirectory) {
  if (!selectedProfileDirectory) return null;
  const candidate = path.isAbsolute(selectedProfileDirectory)
    ? path.resolve(selectedProfileDirectory)
    : path.resolve(extrasDataRoot, selectedProfileDirectory);
  const root = path.resolve(extrasDataRoot);
  if (path.dirname(candidate).toLowerCase() !== root.toLowerCase()) {
    throw new Error('Selected profile directory must be a direct child of the Extras data root.');
  }
  return candidate;
}

export function resolveConfig({
  projectRoot,
  instancePath = DEFAULT_INSTANCE_PATH,
  requestedPort = PORT_RANGE[0],
  selectedProfileDirectory = '',
  env = process.env
} = {}) {
  void env;
  if (!path.isAbsolute(projectRoot || '')) throw new Error('Project root must be an absolute path.');
  if (!path.isAbsolute(instancePath || '')) throw new Error('Minecraft instance path must be an absolute path.');
  const port = Number(requestedPort);
  if (!Number.isInteger(port) || port < PORT_RANGE[0] || port > PORT_RANGE[1]) {
    throw new Error(`Preferred port must be between ${PORT_RANGE[0]} and ${PORT_RANGE[1]}.`);
  }
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedInstancePath = path.resolve(instancePath);
  const extrasDataRoot = path.join(resolvedInstancePath, 'config', 'fishonmcextras', 'data');
  const selectedProfilePath = resolveSelectedProfile(extrasDataRoot, selectedProfileDirectory);
  return Object.freeze({
    host: LOOPBACK_HOST,
    preferredPort: port,
    portRange: [...PORT_RANGE],
    projectRoot: resolvedProjectRoot,
    companionRoot: path.join(resolvedProjectRoot, 'companion'),
    researchRoot: path.join(resolvedProjectRoot, 'research'),
    runtimeRoot: path.join(resolvedProjectRoot, 'bridge', 'runtime'),
    instancePath: resolvedInstancePath,
    instanceFingerprint: fingerprintPath(resolvedInstancePath),
    extrasDataRoot,
    selectedProfileDirectory: selectedProfilePath,
    profileFingerprint: selectedProfilePath ? fingerprintPath(selectedProfilePath) : null,
    latestLogPath: path.join(resolvedInstancePath, 'logs', 'latest.log'),
    collectorLedgerPath: path.join(resolvedInstancePath, 'config', 'fishon-catch-collector', 'catches.jsonl')
  });
}
