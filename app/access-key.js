const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const { writeFileAtomically } = require('./persistence');

const KEY_VERSION = 1;
const FILE_VERSION = 2;
const FILE_MARKER = 'AnimeOn.AccessKey.v2';
const FILE_MARKER_VERSION = 1;
const HASH_BYTES = 64;
const SALT_BYTES = 16;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

function assertEncryptionAvailable(safeStorage) {
  if (!safeStorage || typeof safeStorage.isEncryptionAvailable !== 'function' ||
      !safeStorage.isEncryptionAvailable()) {
    throw new Error('Защита ключа недоступна. Перезапустите приложение.');
  }
}

function normalizeAccessKey(type, value) {
  const secret = String(value || '');
  if (type === 'code') {
    if (!/^\d{6}$/.test(secret)) throw new Error('Код должен состоять из 6 цифр');
    return secret;
  }
  if (type === 'pattern') {
    if (!/^[1-9](?:,[1-9]){3,8}$/.test(secret)) throw new Error('Графический ключ должен содержать от 4 до 9 точек');
    const points = secret.split(',');
    if (new Set(points).size !== points.length) throw new Error('В графическом ключе нельзя повторять точки');
    return secret;
  }
  throw new Error('Неизвестный тип ключа доступа');
}

function deriveHash(secret, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(secret, salt, HASH_BYTES, SCRYPT_OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

async function createAccessKeyRecord(type, value) {
  const secret = normalizeAccessKey(type, value);
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = await deriveHash(secret, salt);
  return {
    version: KEY_VERSION,
    type,
    salt: salt.toString('base64'),
    hash: hash.toString('base64'),
  };
}

function decodeRecord(record) {
  if (!record || record.version !== KEY_VERSION || !['code', 'pattern'].includes(record.type)) {
    throw new Error('Файл ключа доступа повреждён');
  }
  if (typeof record.salt !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(record.salt) ||
      typeof record.hash !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(record.hash)) {
    throw new Error('Файл ключа доступа повреждён');
  }
  const salt = Buffer.from(record.salt, 'base64');
  const hash = Buffer.from(record.hash, 'base64');
  if (salt.length !== SALT_BYTES || hash.length !== HASH_BYTES) throw new Error('Файл ключа доступа повреждён');
  return { salt, hash };
}

async function verifyAccessKeyRecord(record, value) {
  let secret;
  let decoded;
  try {
    secret = normalizeAccessKey(record?.type, value);
    decoded = decodeRecord(record);
  } catch {
    return false;
  }
  const candidate = await deriveHash(secret, decoded.salt);
  return crypto.timingSafeEqual(candidate, decoded.hash);
}

async function verifyStoredAccessKey(filePath, value, safeStorage) {
  const record = await readAccessKeyFile(filePath, safeStorage);
  return verifyAccessKeyRecord(record, value);
}

async function readAccessKeyFile(filePath, safeStorage) {
  const fileContents = await fs.readFile(filePath, 'utf8');
  const stored = JSON.parse(fileContents);
  const markerPath = `${filePath}.marker`;
  const markerExists = await accessKeyFileExists(markerPath);
  let markerMatchesFile = false;
  let interruptedMigrationMarker = false;
  if (markerExists) {
    assertEncryptionAvailable(safeStorage);
    try {
      const marker = safeStorage.decryptString(await fs.readFile(markerPath));
      if (marker === FILE_MARKER) {
        interruptedMigrationMarker = true;
      } else {
        const markerRecord = JSON.parse(marker);
        const digest = crypto.createHash('sha256').update(fileContents, 'utf8').digest('hex');
        if (markerRecord?.version !== FILE_MARKER_VERSION || markerRecord.digest !== digest) {
          throw new Error('invalid marker');
        }
        markerMatchesFile = true;
      }
    } catch {
      throw new Error('Файл защиты ключа повреждён или изменён');
    }
  }
  if (markerMatchesFile && stored?.version !== FILE_VERSION) {
    throw new Error('Обнаружена попытка подмены формата файла ключа');
  }
  if (interruptedMigrationMarker && stored?.version === FILE_VERSION) {
    markerMatchesFile = false;
  }
  let record = stored;
  if (stored?.version === FILE_VERSION) {
    assertEncryptionAvailable(safeStorage);
    if (typeof stored.payload !== 'string') throw new Error('Файл ключа доступа повреждён');
    try {
      record = JSON.parse(safeStorage.decryptString(Buffer.from(stored.payload, 'base64')));
    } catch {
      throw new Error('Файл ключа доступа повреждён или изменён');
    }
  }
  decodeRecord(record);
  return {
    ...record,
    encrypted: stored?.version === FILE_VERSION,
    marked: markerMatchesFile,
    interruptedMigrationMarker,
  };
}

async function writeAccessKeyFile(filePath, record, safeStorage) {
  decodeRecord(record);
  assertEncryptionAvailable(safeStorage);
  const persistedRecord = { ...record };
  delete persistedRecord.encrypted;
  delete persistedRecord.marked;
  delete persistedRecord.interruptedMigrationMarker;
  const payload = safeStorage.encryptString(JSON.stringify(persistedRecord)).toString('base64');
  const fileContents = Buffer.from(JSON.stringify({ version: FILE_VERSION, payload }), 'utf8');
  const digest = crypto.createHash('sha256').update(fileContents).digest('hex');
  const marker = safeStorage.encryptString(JSON.stringify({ version: FILE_MARKER_VERSION, digest }));
  await writeFileAtomically(filePath, fileContents, { mode: 0o600 });
  await writeFileAtomically(`${filePath}.marker`, marker, { mode: 0o600 });
}

async function accessKeyFileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

async function removeAccessKeyMarker(filePath) {
  const markerPath = `${filePath}.marker`;
  try {
    await fs.unlink(markerPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

module.exports = {
  createAccessKeyRecord,
  assertEncryptionAvailable,
  normalizeAccessKey,
  readAccessKeyFile,
  verifyAccessKeyRecord,
  verifyStoredAccessKey,
  writeAccessKeyFile,
  removeAccessKeyMarker,
  accessKeyFileExists,
};
