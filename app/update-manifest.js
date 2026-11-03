const crypto = require('node:crypto');

function normalizeDigest(value) {
  const digest = String(value || '').replace(/^sha256:/i, '').toLowerCase();
  return /^[a-f0-9]{64}$/.test(digest) ? digest : '';
}

function verifySignedUpdateManifest({
  manifestBytes,
  signatureText,
  publicKey,
  version,
  assetName,
  assetSize,
  assetDigest,
}) {
  const encodedSignature = String(signatureText || '').trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encodedSignature)) throw new Error('Invalid update manifest signature format');
  const signature = Buffer.from(encodedSignature, 'base64');
  if (signature.length !== 64 || signature.toString('base64') !== encodedSignature) {
    throw new Error('Invalid update manifest signature encoding');
  }

  const trustedKey = publicKey?.type === 'public' ? publicKey : crypto.createPublicKey(publicKey);
  if (trustedKey.asymmetricKeyType !== 'ed25519') throw new Error('Update manifest key must be Ed25519');
  if (!crypto.verify(null, manifestBytes, trustedKey, signature)) {
    throw new Error('Update manifest signature verification failed');
  }

  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch (error) {
    throw new Error(`Invalid update manifest JSON: ${String(error.message || error)}`);
  }
  if (manifest?.schemaVersion !== 1 || String(manifest.version || '') !== String(version || '')) {
    throw new Error('Update manifest version does not match the release');
  }
  if (!Array.isArray(manifest.files)) throw new Error('Update manifest file list is invalid');

  const entry = manifest.files.find((file) => file?.name === assetName);
  const manifestDigest = normalizeDigest(entry?.sha256);
  if (!entry || !manifestDigest || !Number.isSafeInteger(entry.size) || entry.size <= 0) {
    throw new Error('Update manifest does not describe the installer');
  }
  if (Number(assetSize) > 0 && entry.size !== Number(assetSize)) {
    throw new Error('Update manifest installer size does not match the release');
  }
  const releaseDigest = assetDigest ? normalizeDigest(assetDigest) : '';
  if (assetDigest && (!releaseDigest || releaseDigest !== manifestDigest)) {
    throw new Error('Update manifest checksum does not match the release');
  }

  return { sha256: manifestDigest, size: entry.size };
}

module.exports = { verifySignedUpdateManifest };
