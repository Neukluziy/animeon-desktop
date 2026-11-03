const MAX_ARGUMENT_DEPTH = 8;
const MAX_OBJECT_ENTRIES = 1000;
const MAX_STRING_LENGTH = 200000;
const MAX_ARGUMENT_NODES = 10000;
const MAX_TOTAL_STRING_LENGTH = 1000000;

function isRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isSafeArgument(value, depth = 0, budget = { nodes: 0, stringCharacters: 0 }) {
  if (depth > MAX_ARGUMENT_DEPTH) return false;
  budget.nodes += 1;
  if (budget.nodes > MAX_ARGUMENT_NODES) return false;
  if (value === undefined) return true;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'string') {
    budget.stringCharacters += value.length;
    return value.length <= MAX_STRING_LENGTH && budget.stringCharacters <= MAX_TOTAL_STRING_LENGTH;
  }
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) {
    return value.length <= MAX_OBJECT_ENTRIES && value.every((item) => isSafeArgument(item, depth + 1, budget));
  }
  if (!isRecord(value)) return false;
  const entries = Object.entries(value);
  if (entries.length > MAX_OBJECT_ENTRIES) return false;
  for (const [key, item] of entries) {
    budget.stringCharacters += key.length;
    if (
      key.length > 200 ||
      budget.stringCharacters > MAX_TOTAL_STRING_LENGTH ||
      !isSafeArgument(item, depth + 1, budget)
    ) {
      return false;
    }
  }
  return true;
}

const CHANNEL_VALIDATORS = {
  'accounts:add': (args) => args.length === 1 && typeof args[0] === 'string' && args[0].length <= 40,
  'accounts:activate': (args) => args.length === 1 && typeof args[0] === 'string' && args[0].length <= 64,
  'accounts:delete': (args) => args.length === 1 && typeof args[0] === 'string' && args[0].length <= 64,
  'access-key:prompt-setting': (args) => args.length === 1 && typeof args[0] === 'boolean',
  'access-key:set': (args) =>
    args.length >= 2 &&
    args.length <= 3 &&
    ['code', 'pattern'].includes(args[0]) &&
    typeof args[1] === 'string' &&
    args[1].length <= 32 &&
    (args.length === 2 || args[2] === undefined || (typeof args[2] === 'string' && args[2].length <= 32)),
  'access-key:verify': (args) => args.length === 1 && typeof args[0] === 'string' && args[0].length <= 32,
  'access-key:remove': (args) => args.length === 1 && typeof args[0] === 'string' && args[0].length <= 32,
  'cfg:set': (args) => args.length === 1 && isRecord(args[0]),
  'library:set': (args) => args.length === 1 && isRecord(args[0]),
  'watch:notes:add': (args) => args.length === 1 && typeof args[0] === 'string' && args[0].length <= 1000,
  'watch:notes:delete': (args) => args.length === 1 && typeof args[0] === 'string' && args[0].length <= 128,
  'screenshots:thumb': (args) => args.length === 1 && typeof args[0] === 'string' && args[0].length <= 4096,
  'screenshots:open': (args) => args.length === 1 && typeof args[0] === 'string' && args[0].length <= 4096,
  'screenshots:show': (args) => args.length === 1 && typeof args[0] === 'string' && args[0].length <= 4096,
  'screenshots:copy': (args) => args.length === 1 && typeof args[0] === 'string' && args[0].length <= 4096,
  'screenshots:delete': (args) => args.length === 1 && typeof args[0] === 'string' && args[0].length <= 4096,
  'site:apply-css': (args) => args.length === 1 && typeof args[0] === 'string' && args[0].length <= 200000,
  'hotkeys:set': (args) => args.length === 1 && isRecord(args[0]),
  'media:seek-to': (args) => args.length === 1 && typeof args[0] === 'number' && args[0] >= 0,
  'media:speed': (args) =>
    args.length === 1 && typeof args[0] === 'number' && [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].includes(args[0]),
  'media:select-option': (args) =>
    args.length === 2 &&
    ['audio', 'quality', 'dubbing', 'resolution', 'source'].includes(args[0]) &&
    (typeof args[1] === 'string' || typeof args[1] === 'number'),
  'sleep:set': (args) =>
    args.length >= 1 &&
    args.length <= 2 &&
    typeof args[0] === 'number' &&
    Number.isInteger(args[0]) &&
    args[0] >= 0 &&
    args[0] <= 10080 &&
    (args.length === 1 || ['pause', 'tray', 'exit'].includes(args[1])),
  'net:settings:set': (args) => args.length === 1 && isRecord(args[0]),
};

function createValidatedIpcMain(ipcMain, isTrustedAppEvent, onRejected = () => {}) {
  return new Proxy(ipcMain, {
    get(target, property) {
      if (property === 'handle') {
        return (channel, listener) =>
          target.handle(channel, (event, ...args) => {
            if (!isTrustedAppEvent(event)) throw new Error(`Недоверенный IPC-источник: ${channel}`);
            if (args.length > 32 || !isSafeArgument(args))
              throw new TypeError(`Некорректные IPC-аргументы: ${channel}`);
            const validate = CHANNEL_VALIDATORS[channel];
            if (validate && !validate(args)) throw new TypeError(`Некорректные IPC-аргументы: ${channel}`);
            return listener(event, ...args);
          });
      }
      if (property === 'on' || property === 'once' || property === 'addListener') {
        return (channel, listener) =>
          target[property](channel, (event, ...args) => {
            if (!isTrustedAppEvent(event)) {
              onRejected(channel, 'untrusted sender');
              return;
            }
            if (args.length > 32 || !isSafeArgument(args)) {
              onRejected(channel, 'invalid arguments');
              return;
            }
            return listener(event, ...args);
          });
      }
      const value = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}

module.exports = { createValidatedIpcMain, isSafeArgument };
