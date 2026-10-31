const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DATA_FILES = {
  history: { file: 'history.json', fields: ['history', 'recentPages'] },
  bookmarks: { file: 'bookmarks.json', fields: ['favorites', 'pageFavorites'] },
  playback: { file: 'playback.json', fields: ['playbackPositions'] },
  notes: { file: 'watch-notes.json', fields: ['watchNotes'] },
  library: { file: 'library.json', fields: ['library'] },
  errorLog: { file: 'error-log.json', fields: ['errorLog'] },
};

const DEFAULT_DATA = {
  history: [],
  recentPages: [],
  favorites: [],
  pageFavorites: [],
  playbackPositions: {},
  watchNotes: [],
  library: { favorites: [], continueWatching: [], localHistory: [] },
  errorLog: [],
};

function isValidValue(key, value) {
  if (key === 'playbackPositions') return !!value && typeof value === 'object' && !Array.isArray(value);
  if (key === 'library') return !!value && typeof value === 'object' && !Array.isArray(value);
  return Array.isArray(value);
}

function normalizeValue(key, value) {
  if (key === 'library') {
    const library = { ...value };
    for (const name of Object.keys(DEFAULT_DATA.library)) {
      if (!Array.isArray(library[name])) library[name] = [];
    }
    return library;
  }
  return value;
}

function writeJsonAtomically(fsModule, filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fsModule.writeFileSync(temporaryPath, JSON.stringify(value, null, 2), { encoding: 'utf8', flag: 'wx' });
    fsModule.renameSync(temporaryPath, filePath);
  } catch (error) {
    try { fsModule.unlinkSync(temporaryPath); } catch {}
    throw error;
  }
}

function createUserDataStore({ userDataPath, fs: fsModule = fs, path: pathModule = path }) {
  const cache = new Map();

  function filePathFor(bucket) {
    return pathModule.join(userDataPath, DATA_FILES[bucket].file);
  }

  function load(config) {
    fsModule.mkdirSync(userDataPath, { recursive: true });
    for (const [bucket, descriptor] of Object.entries(DATA_FILES)) {
      const filePath = filePathFor(bucket);
      let data;
      if (fsModule.existsSync(filePath)) {
        data = JSON.parse(fsModule.readFileSync(filePath, 'utf8'));
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error(`Файл ${descriptor.file} повреждён`);
        }
      } else {
        data = {};
        for (const key of descriptor.fields) {
          const legacyValue = config[key];
          data[key] = isValidValue(key, legacyValue) ? legacyValue : DEFAULT_DATA[key];
        }
      }

      for (const key of descriptor.fields) {
        const value = data[key];
        if (value !== undefined && !isValidValue(key, value)) {
          throw new Error(`Данные «${key}» в файле ${descriptor.file} повреждены`);
        }
        config[key] = normalizeValue(key, value === undefined ? DEFAULT_DATA[key] : value);
      }
      const normalizedData = Object.fromEntries(descriptor.fields.map((key) => [key, config[key]]));
      const serialized = JSON.stringify(normalizedData);
      cache.set(bucket, serialized);
      const shouldWrite = !fsModule.existsSync(filePath) ||
        JSON.stringify(JSON.parse(fsModule.readFileSync(filePath, 'utf8'))) !== serialized;
      if (shouldWrite) {
        writeJsonAtomically(fsModule, filePath, normalizedData);
      }
    }
  }

  function save(config) {
    for (const [bucket, descriptor] of Object.entries(DATA_FILES)) {
      const data = Object.fromEntries(descriptor.fields.map((key) => [key, config[key]]));
      const serialized = JSON.stringify(data);
      if (cache.get(bucket) === serialized) continue;
      writeJsonAtomically(fsModule, filePathFor(bucket), data);
      cache.set(bucket, serialized);
    }
  }

  function stripFromConfig(config) {
    const persistedConfig = { ...config };
    for (const descriptor of Object.values(DATA_FILES)) {
      for (const key of descriptor.fields) delete persistedConfig[key];
    }
    return persistedConfig;
  }

  return { load, save, stripFromConfig };
}

module.exports = { createUserDataStore, DATA_FILES };
