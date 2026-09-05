import crypto from 'node:crypto';
import { readFile as fsReadFile, stat as fsStat } from 'node:fs/promises';

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

export class SourceReadError extends Error {
  constructor(publicCode, publicMessage, metadata = {}, cause) {
    super(publicMessage, cause ? { cause } : undefined);
    this.name = 'SourceReadError';
    this.publicCode = publicCode;
    this.publicMessage = publicMessage;
    this.metadata = Object.freeze({ ...metadata });
  }
}

function malformedMetadata(content) {
  const buffer = Buffer.isBuffer(content) ? content : Buffer.from(String(content), 'utf8');
  return {
    byteLength: buffer.byteLength,
    contentHash: crypto.createHash('sha256').update(buffer).digest('hex')
  };
}

export async function readJsonWithRetry(filePath, { attempts = 4, delayMs = 75 } = {}, dependencies = {}) {
  const readFile = dependencies.readFile || fsReadFile;
  const stat = dependencies.stat || fsStat;
  const delay = dependencies.delay || wait;
  const totalAttempts = Math.max(1, Math.floor(attempts));
  let lastContent = '';
  let lastError;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      lastContent = await readFile(filePath, 'utf8');
      const value = JSON.parse(String(lastContent));
      const details = await stat(filePath);
      return {
        value,
        source: {
          path: filePath,
          modifiedAt: details.mtime.toISOString(),
          size: details.size,
          observedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      if (error?.code === 'ENOENT') {
        throw new SourceReadError('SOURCE_MISSING', 'The source file is not available.', {}, error);
      }
      if (error instanceof SyntaxError) {
        lastError = error;
        if (attempt < totalAttempts) {
          await delay(delayMs);
          continue;
        }
        break;
      }
      throw new SourceReadError('SOURCE_UNREADABLE', 'The source file could not be read.', {}, error);
    }
  }

  throw new SourceReadError(
    'SOURCE_MALFORMED',
    'The source file is temporarily malformed. The last valid data will be retained.',
    malformedMetadata(lastContent),
    lastError
  );
}
