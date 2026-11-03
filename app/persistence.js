const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

async function writeFileAtomically(filePath, contents, options = {}) {
  const directory = path.dirname(filePath);
  const temporaryPath = `${filePath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  await fs.mkdir(directory, { recursive: true });

  try {
    await fs.writeFile(temporaryPath, contents, { ...options, flag: 'wx' });
    await fs.rename(temporaryPath, filePath);
  } catch (error) {
    try {
      await fs.unlink(temporaryPath);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') error.cleanupError = cleanupError;
    }
    throw error;
  }
}

async function copyFileAtomically(sourcePath, destinationPath) {
  const directory = path.dirname(destinationPath);
  const temporaryPath = `${destinationPath}.${process.pid}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  await fs.mkdir(directory, { recursive: true });

  try {
    await fs.copyFile(sourcePath, temporaryPath);
    await fs.rename(temporaryPath, destinationPath);
  } catch (error) {
    try {
      await fs.unlink(temporaryPath);
    } catch (cleanupError) {
      if (cleanupError.code !== 'ENOENT') error.cleanupError = cleanupError;
    }
    throw error;
  }
}

module.exports = { copyFileAtomically, writeFileAtomically };
