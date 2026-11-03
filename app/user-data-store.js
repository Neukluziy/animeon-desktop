const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { writeFileAtomically } = require('./persistence');

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

function writeJsonAtomicallySync(fsModule, filePath, value) {
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  try {
    fsModule.writeFileSync(temporaryPath, JSON.stringify(value, null, 2), { encoding: 'utf8', flag: 'wx' });
    fsModule.renameSync(temporaryPath, filePath);
  } catch (error) {
    try {
      fsModule.unlinkSync(temporaryPath);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') error.cleanupError = cleanupError;
    }
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
    const recoveryIssues = [];
    for (const [bucket, descriptor] of Object.entries(DATA_FILES)) {
      const filePath = filePathFor(bucket);
      let data;
      let shouldWrite = !fsModule.existsSync(filePath);
      if (!shouldWrite) {
        try {
          data = JSON.parse(fsModule.readFileSync(filePath, 'utf8'));
          if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error(`Файл ${descriptor.file} повреждён`);
          }
          for (const key of descriptor.fields) {
            if (data[key] !== undefined && !isValidValue(key, data[key])) {
              throw new Error(`Данные «${key}» в файле ${descriptor.file} повреждены`);
            }
          }
        } catch (error) {
          const corruptPath = `${filePath}.corrupt-${Date.now()}`;
          let backupError = null;
          try {
            fsModule.copyFileSync(filePath, corruptPath);
          } catch (copyError) {
            backupError = copyError;
          }
          recoveryIssues.push({ file: descriptor.file, error, corruptPath, backupError });
          data = {};
          shouldWrite = true;
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
        const legacyValue = config[key];
        const fallback = isValidValue(key, legacyValue) ? legacyValue : DEFAULT_DATA[key];
        config[key] = normalizeValue(key, value === undefined ? fallback : value);
      }
      const normalizedData = Object.fromEntries(descriptor.fields.map((key) => [key, config[key]]));
      const serialized = JSON.stringify(normalizedData);
      cache.set(bucket, serialized);
      if (shouldWrite || JSON.stringify(data) !== serialized) {
        writeJsonAtomicallySync(fsModule, filePath, normalizedData);
      }
    }
    return recoveryIssues;
  }

  async function save(config) {
    for (const [bucket, descriptor] of Object.entries(DATA_FILES)) {
      const data = Object.fromEntries(descriptor.fields.map((key) => [key, config[key]]));
      const serialized = JSON.stringify(data);
      if (cache.get(bucket) === serialized) continue;
      await writeFileAtomically(filePathFor(bucket), JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
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
