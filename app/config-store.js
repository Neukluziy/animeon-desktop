class ConfigStore {
  constructor({
    config,
    defaults,
    configPath,
    fs,
    userDataStore,
    migrateConfig,
    sanitizeConfig,
    copyFileAtomically,
    writeFileAtomically,
    logger = console,
    debounceMs = 400,
  }) {
    this.config = config;
    this.defaults = defaults;
    this.configPath = configPath;
    this.fs = fs;
    this.userDataStore = userDataStore;
    this.migrateConfig = migrateConfig;
    this.sanitizeConfig = sanitizeConfig;
    this.copyFileAtomically = copyFileAtomically;
    this.writeFileAtomically = writeFileAtomically;
    this.logger = logger;
    this.debounceMs = debounceMs;
    this.saveTimer = null;
    this.writePromise = Promise.resolve();
    this.savePending = false;
    this.preserveBackup = false;
  }

  normalize(rawConfig) {
    return this.sanitizeConfig(this.migrateConfig(rawConfig), this.defaults);
  }

  load() {
    let loadError = null;
    let recoveredFromBackup = false;
    try {
      Object.assign(this.config, this.normalize(JSON.parse(this.fs.readFileSync(this.configPath, 'utf8'))));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        loadError = error;
        const backupPath = `${this.configPath}.bak`;
        let backupConfig;
        try {
          backupConfig = this.normalize(JSON.parse(this.fs.readFileSync(backupPath, 'utf8')));
        } catch (backupError) {
          loadError.backupError = backupError;
          let backupExists = false;
          let canCopyCorruptConfig = true;
          try {
            this.fs.accessSync(backupPath);
            backupExists = true;
          } catch (accessError) {
            if (accessError.code !== 'ENOENT') {
              loadError.corruptCopyError = accessError;
              canCopyCorruptConfig = false;
            }
          }
          if (canCopyCorruptConfig) {
            try {
              this.fs.copyFileSync(this.configPath, backupExists ? `${backupPath}.corrupt-${Date.now()}` : backupPath);
            } catch (copyError) {
              loadError.corruptCopyError = copyError;
            }
          }
        }
        if (backupConfig) {
          Object.assign(this.config, backupConfig);
          this.preserveBackup = true;
          try {
            this.fs.copyFileSync(this.configPath, `${this.configPath}.corrupt-${Date.now()}`);
          } catch (copyError) {
            loadError.corruptCopyError = copyError;
          }
          try {
            this.fs.copyFileSync(backupPath, this.configPath);
          } catch (restoreError) {
            loadError.restoreError = restoreError;
          }
          recoveredFromBackup = true;
        }
      }
    }

    return { loadError, recoveredFromBackup };
  }

  save() {
    this.savePending = true;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.enqueueSave();
    }, this.debounceMs);
  }

  enqueueSave() {
    this.savePending = false;
    const snapshot = JSON.stringify(this.userDataStore.stripFromConfig(this.config), null, 2);
    const write = this.writePromise
      .then(undefined, (previousError) => {
        this.logger.error(`[AnimeOn] Previous config save failed: ${String(previousError?.stack || previousError)}`);
      })
      .then(async () => {
        await this.userDataStore.save(this.config);
        if (!this.preserveBackup) {
          try {
            await this.fs.promises.access(this.configPath);
            await this.copyFileAtomically(this.configPath, `${this.configPath}.bak`);
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
          }
        }
        await this.writeFileAtomically(this.configPath, snapshot, { encoding: 'utf8', mode: 0o600 });
        this.preserveBackup = false;
      });
    this.writePromise = write;
    write.catch((error) => {
      this.logger.error(`[AnimeOn] Failed to save app data: ${String(error?.stack || error)}`);
    });
    return write;
  }

  async flush() {
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (this.savePending) this.enqueueSave();
    await this.writePromise;
  }
}

module.exports = { ConfigStore };
