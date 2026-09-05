import path from 'node:path';
import { watch } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolveConfig, PORT_RANGE } from './config.js';
import { readJsonWithRetry } from './safe-json.js';
import { createMetadataQuarantine } from './quarantine.js';
import { createExtrasAdapter } from './extras-adapter.js';
import { readSessionStatus } from './session-status-adapter.js';
import { readCatchCollection } from './catch-log-adapter.js';
import { mergePersonalCatchCollections, readCollectorCatchCollection } from './collector-catch-adapter.js';
import { buildRecommendations } from './recommendations.js';
import { createStateService } from './state-service.js';
import { createGuideServer } from './http-server.js';

export function parseArgs(argv = []) {
  const output = {};
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (!['--instance', '--port', '--profile-dir'].includes(name)) throw new Error(`Unknown argument: ${name}`);
    const value = argv[index + 1];
    if (value === undefined || String(value).startsWith('--')) throw new Error(`Argument ${name} requires a value.`);
    index += 1;
    if (name === '--instance') output.instancePath = value;
    if (name === '--profile-dir') output.selectedProfileDirectory = value;
    if (name === '--port') {
      const port = Number(value);
      if (!Number.isInteger(port)) throw new Error('Port must be an integer.');
      output.requestedPort = port;
    }
  }
  return output;
}

export async function listenWithFallback(guideServer, preferredPort, [minimum, maximum] = PORT_RANGE) {
  const ports = [];
  for (let port = preferredPort; port <= maximum; port += 1) ports.push(port);
  for (let port = minimum; port < preferredPort; port += 1) ports.push(port);
  let lastCollision;
  for (const port of ports) {
    try { return await guideServer.listen(port); }
    catch (error) {
      if (error?.code !== 'EADDRINUSE') throw error;
      lastCollision = error;
    }
  }
  const error = new Error(`Every FishOnMC guide port from ${minimum} through ${maximum} is occupied.`, { cause: lastCollision });
  error.code = 'NO_AVAILABLE_PORT';
  throw error;
}

export function createSessionAdapter({ latestLogPath, collectorLedgerPath }, dependencies = {}) {
  const readStatus = dependencies.readSessionStatus || readSessionStatus;
  const readLogCatches = dependencies.readCatchCollection || readCatchCollection;
  const readCollectorCatches = dependencies.readCollectorCatchCollection || readCollectorCatchCollection;
  return {
    readStatus: () => readStatus({ latestLogPath }),
    readCatches: async () => {
      const [collector, log] = await Promise.all([
        readCollectorCatches({ ledgerPath: collectorLedgerPath }),
        readLogCatches({ latestLogPath })
      ]);
      return mergePersonalCatchCollections(collector, log);
    }
  };
}

function createSourceWatcher(paths, callback) {
  const watchers = [];
  for (const target of paths) {
    try {
      const watcher = watch(target, { persistent: false }, callback);
      watchers.push(watcher);
    } catch { /* Periodic rediscovery remains active when a path is absent. */ }
  }
  return { close() { for (const watcher of watchers) watcher.close(); } };
}

export async function run(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const projectRoot = path.resolve(import.meta.dirname, '../..');
  const config = resolveConfig({ projectRoot, ...args });
  const quarantine = createMetadataQuarantine({ rootPath: path.join(config.runtimeRoot, 'quarantine') });
  const extrasAdapter = createExtrasAdapter({
    dataRoot: config.extrasDataRoot,
    selectedProfileDirectory: config.selectedProfileDirectory,
    readJson: filePath => readJsonWithRetry(filePath),
    quarantine
  });
  const sessionAdapter = createSessionAdapter(config);
  const publicMode = process.env.FISHON_PUBLIC_MODE === '1';
  const stateService = createStateService({
    extrasAdapter,
    sessionAdapter,
    recommendations: snapshot => buildRecommendations(snapshot, { publicMode }),
    watchFactory: callback => createSourceWatcher([
      config.extrasDataRoot,
      path.dirname(config.latestLogPath),
      path.dirname(config.collectorLedgerPath)
    ], callback)
  });
  await stateService.start();
  const guideServer = await createGuideServer({
    host: config.host,
    companionRoot: config.companionRoot,
    researchRoot: config.researchRoot,
    stateService,
    instanceFingerprint: config.instanceFingerprint,
    serviceName: publicMode ? 'fishonmc-tracker-bridge' : 'fishonmc-live-guide-bridge',
    serveResearchDocuments: !publicMode
  });
  const address = await listenWithFallback(guideServer, config.preferredPort, config.portRange);
  const url = `http://127.0.0.1:${address.port}/`;
  process.stdout.write(`${publicMode ? 'FISHON_TRACKER_READY' : 'FISHON_GUIDE_READY'} ${url}\n`);

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    stateService.stop();
    await guideServer.close();
  };
  process.once('SIGINT', () => stop().finally(() => process.exit(0)));
  process.once('SIGTERM', () => stop().finally(() => process.exit(0)));
  return { url, config, stateService, guideServer, stop };
}

const executedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (executedDirectly) {
  run().catch(error => {
    const product = process.env.FISHON_PUBLIC_MODE === '1' ? 'Tracker' : 'guide bridge';
    process.stderr.write(`FishOnMC ${product} failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}
