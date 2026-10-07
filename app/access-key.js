const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const KEY_VERSION = 1;
const HASH_BYTES = 64;
const SALT_BYTES = 16;
const SCRYPT_OPTIONS = { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

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

async function verifyStoredAccessKey(filePath, value) {
  const record = readAccessKeyFile(filePath);
  return verifyAccessKeyRecord(record, value);
}

function readAccessKeyFile(filePath) {
  const record = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  decodeRecord(record);
  return record;
}

function writeAccessKeyFile(filePath, record) {
  decodeRecord(record);
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fs.writeFileSync(temporaryPath, JSON.stringify(record), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
    fs.renameSync(temporaryPath, filePath);
  } catch (error) {
    try { fs.unlinkSync(temporaryPath); } catch {}
    throw error;
  }
}

module.exports = {
  createAccessKeyRecord,
  normalizeAccessKey,
  readAccessKeyFile,
  verifyAccessKeyRecord,
  verifyStoredAccessKey,
  writeAccessKeyFile,
};
