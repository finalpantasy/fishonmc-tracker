import path from 'node:path';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';

const ALLOWED_SOURCE_KINDS = new Set(['extras-profile', 'extras-quest', 'extras-stats']);
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;

function basicTimestamp(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new TypeError('A valid observedAt timestamp is required.');
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function validateRecord(input) {
  if (!ALLOWED_SOURCE_KINDS.has(input?.sourceKind)) throw new TypeError('Invalid quarantine source kind.');
  if (!HASH_PATTERN.test(input.contentHash || '')) throw new TypeError('Invalid quarantine content hash.');
  if (!ERROR_CODE_PATTERN.test(input.errorCode || '')) throw new TypeError('Invalid quarantine error code.');
  const byteLength = Number(input.byteLength);
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) throw new TypeError('Invalid quarantine byte length.');
  return {
    schemaVersion: 1,
    sourceKind: input.sourceKind,
    observedAt: new Date(input.observedAt).toISOString(),
    byteLength,
    contentHash: input.contentHash,
    errorCode: input.errorCode
  };
}

export function createMetadataQuarantine({ rootPath, maxPerKind = 5, maxTotal = 25 } = {}) {
  if (!path.isAbsolute(rootPath || '')) throw new TypeError('Quarantine root must be an absolute path.');
  const canonicalRoot = path.resolve(rootPath);

  async function listRecords() {
    const records = [];
    for (const kind of ALLOWED_SOURCE_KINDS) {
      const kindRoot = path.join(canonicalRoot, kind);
      let files;
      try { files = await readdir(kindRoot); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
      for (const file of files.filter(name => name.endsWith('.json'))) {
        const recordPath = path.join(kindRoot, file);
        try { records.push({ recordPath, record: JSON.parse(await readFile(recordPath, 'utf8')) }); }
        catch { /* An invalid metadata record is ignored, never served. */ }
      }
    }
    return records;
  }

  async function prune(records, sourceKind) {
    const byKind = records.filter(item => item.record.sourceKind === sourceKind)
      .sort((a, b) => String(a.record.observedAt).localeCompare(String(b.record.observedAt)));
    while (byKind.length > maxPerKind) {
      const removed = byKind.shift();
      if (path.dirname(path.dirname(path.resolve(removed.recordPath))) !== canonicalRoot) throw new Error('Unsafe quarantine prune target.');
      await unlink(removed.recordPath);
      records.splice(records.indexOf(removed), 1);
    }
    records.sort((a, b) => String(a.record.observedAt).localeCompare(String(b.record.observedAt)));
    while (records.length > maxTotal) {
      const removed = records.shift();
      if (path.dirname(path.dirname(path.resolve(removed.recordPath))) !== canonicalRoot) throw new Error('Unsafe quarantine prune target.');
      await unlink(removed.recordPath);
    }
  }

  async function record(input) {
    const safeRecord = validateRecord(input);
    const existing = await listRecords();
    const duplicate = existing.find(item => item.record.sourceKind === safeRecord.sourceKind && item.record.contentHash === safeRecord.contentHash);
    if (duplicate) return { duplicate: true, recordPath: duplicate.recordPath, record: safeRecord };
    const kindRoot = path.join(canonicalRoot, safeRecord.sourceKind);
    await mkdir(kindRoot, { recursive: true });
    const fileName = `${basicTimestamp(safeRecord.observedAt)}-${safeRecord.contentHash.slice(0, 16)}.json`;
    const recordPath = path.resolve(kindRoot, fileName);
    if (path.dirname(recordPath) !== kindRoot) throw new Error('Unsafe quarantine record target.');
    await writeFile(recordPath, `${JSON.stringify(safeRecord, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    existing.push({ recordPath, record: safeRecord });
    await prune(existing, safeRecord.sourceKind);
    return { duplicate: false, recordPath, record: safeRecord };
  }

  return Object.freeze({ record, listRecords });
}
