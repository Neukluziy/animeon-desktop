const crypto = require('node:crypto');

const DEFAULT_ACCOUNT_ID = 'default';
const DEFAULT_ACCOUNT_NAME = 'Основной аккаунт';

function accountPartition(id) {
  return id === DEFAULT_ACCOUNT_ID ? 'persist:animeon' : `persist:animeon-account-${id}`;
}

function normalizeAccounts(config) {
  const seen = new Set([DEFAULT_ACCOUNT_ID]);
  const stored = Array.isArray(config.accounts) ? config.accounts : [];
  const defaultEntry = stored.find((item) => item?.id === DEFAULT_ACCOUNT_ID);
  const accounts = [{
    id: DEFAULT_ACCOUNT_ID,
    name: String(defaultEntry?.name || DEFAULT_ACCOUNT_NAME).trim().slice(0, 40) || DEFAULT_ACCOUNT_NAME,
    partition: accountPartition(DEFAULT_ACCOUNT_ID),
  }];

  for (const item of stored) {
    const id = String(item?.id || '');
    if (!/^[a-z0-9-]{1,64}$/i.test(id) || seen.has(id)) continue;
    seen.add(id);
    accounts.push({
      id,
      name: String(item?.name || 'Аккаунт').trim().slice(0, 40) || 'Аккаунт',
      partition: accountPartition(id),
    });
  }

  config.accounts = accounts;
  if (!seen.has(String(config.activeAccountId || ''))) config.activeAccountId = DEFAULT_ACCOUNT_ID;
  return accounts;
}

function createAccount(name) {
  const label = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  if (!label) return null;
  const id = crypto.randomUUID();
  return { id, name: label, partition: accountPartition(id) };
}

module.exports = {
  DEFAULT_ACCOUNT_ID,
  DEFAULT_ACCOUNT_NAME,
  accountPartition,
  normalizeAccounts,
  createAccount,
};
