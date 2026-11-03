const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const GENERATED_FILES = new Set([
  'SHA256SUMS.txt',
  'update-manifest.json',
  'update-manifest.json.sig',
]);

function isReleaseAsset(name) {
  return /\.exe(?:\.blockmap)?$/i.test(name) || name === 'latest.yml';
}

function createReleaseManifest({ directory, version, privateKey, passphrase }) {
  const releaseFiles = fs.readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && isReleaseAsset(entry.name) && !GENERATED_FILES.has(entry.name))
    .map((entry) => {
      const filePath = path.join(directory, entry.name);
      const contents = fs.readFileSync(filePath);
      return {
        name: entry.name,
        size: contents.length,
        sha256: crypto.createHash('sha256').update(contents).digest('hex'),
      };
    })
    .sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));

  if (!releaseFiles.length) throw new Error('No release files found in the output directory');

  const manifest = {
    schemaVersion: 1,
    version,
    files: releaseFiles,
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  const checksumLines = releaseFiles.map(({ name, sha256 }) => `${sha256}  ${name}`);

  fs.writeFileSync(path.join(directory, 'SHA256SUMS.txt'), `${checksumLines.join('\n')}\n`, 'utf8');
  fs.writeFileSync(path.join(directory, 'update-manifest.json'), manifestBytes);

  const signaturePath = path.join(directory, 'update-manifest.json.sig');
  if (privateKey) {
    const key = crypto.createPrivateKey({
      key: privateKey,
      format: 'pem',
      ...(passphrase ? { passphrase } : {}),
    });
    if (key.asymmetricKeyType !== 'ed25519') {
      throw new TypeError('UPDATE_MANIFEST_PRIVATE_KEY must be an Ed25519 private key');
    }
    const signature = crypto.sign(null, manifestBytes, key).toString('base64');
    fs.writeFileSync(signaturePath, `${signature}\n`, 'ascii');
  } else {
    fs.rmSync(signaturePath, { force: true });
  }

  return manifest;
}

function prepareUpdateTrust({ directory, privateKey, passphrase }) {
  const trustPath = path.join(directory, 'update-trust.json');
  if (!privateKey) {
    fs.rmSync(trustPath, { force: true });
    return false;
  }
  const key = crypto.createPrivateKey({
    key: privateKey,
    format: 'pem',
    ...(passphrase ? { passphrase } : {}),
  });
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new TypeError('UPDATE_MANIFEST_PRIVATE_KEY must be an Ed25519 private key');
  }
  const publicKey = crypto.createPublicKey(key).export({ type: 'spki', format: 'pem' });
  fs.writeFileSync(trustPath, `${JSON.stringify({ algorithm: 'Ed25519', publicKey }, null, 2)}\n`, 'utf8');
  return true;
}

if (require.main === module) {
  const packageJson = require('../package.json');
  const privateKey = process.env.UPDATE_MANIFEST_PRIVATE_KEY;
  const passphrase = process.env.UPDATE_MANIFEST_PRIVATE_KEY_PASSPHRASE;
  if (process.argv.includes('--prepare-key')) {
    const prepared = prepareUpdateTrust({
      directory: path.resolve('app'),
      privateKey,
      passphrase,
    });
    console.log(prepared ? 'Prepared Ed25519 update trust key.' : 'Update-manifest signing is not configured.');
  } else {
    const manifest = createReleaseManifest({
      directory: path.resolve(process.argv[2] || 'dist'),
      version: packageJson.version,
      privateKey,
      passphrase,
    });
    console.log(`Created update manifest for ${manifest.version} (${manifest.files.length} files).`);
  }
}

module.exports = { createReleaseManifest, isReleaseAsset, prepareUpdateTrust };
