const path = require('node:path');

function createAppLogger({ fs, logPath, config, maxEntries, saveConfig, performance }) {
  const startupStages = new Set();
  let logWritePromise = Promise.resolve();

  function writeLog(level, message, meta) {
    const time = new Date().toISOString();
    const entry = JSON.stringify({ time, level, message: String(message || ''), meta: meta || null });
    config.errorLog = [{ time, level, message: String(message || '') }, ...(config.errorLog || [])].slice(0, maxEntries);
    const write = logWritePromise.catch((previousError) => {
      process.stderr.write(`[AnimeOn] Previous log write failed: ${String(previousError?.stack || previousError)}\n`);
    }).then(() => fs.promises.mkdir(path.dirname(logPath), { recursive: true }))
      .then(() => fs.promises.appendFile(logPath, `${entry}\n`, 'utf8'));
    logWritePromise = write;
    write.catch((error) => process.stderr.write(`[AnimeOn] Failed to write log: ${String(error?.stack || error)}\n`));
    saveConfig();
  }

  function markStartup(stage) {
    if (startupStages.has(stage)) return;
    startupStages.add(stage);
    const entry = performance.getEntriesByName('animeon-start')[0];
    const elapsedMs = Math.round((performance.now() - (entry?.startTime || 0)) * 10) / 10;
    performance.mark(`animeon-${stage}`);
    writeLog('info', 'Startup milestone', { stage, elapsedMs });
  }

  async function flushLogWrites() {
    await logWritePromise;
  }

  return { flushLogWrites, markStartup, writeLog };
}

module.exports = { createAppLogger };
