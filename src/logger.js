const fs = require('node:fs');
const path = require('node:path');

function createLogger(options) {
  const file = path.resolve(options.path); const max = options.maxBytes;
  let pending = Promise.resolve();
  async function append(line) {
    await fs.promises.mkdir(path.dirname(file), { recursive: true });
    try {
      const size = (await fs.promises.stat(file)).size;
      if (size + Buffer.byteLength(line) > max) {
        await fs.promises.rm(`${file}.1`, { force: true });
        await fs.promises.rename(file, `${file}.1`);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    await fs.promises.appendFile(file, line, 'utf8');
  }
  function write(level, message, data) {
    const line = JSON.stringify({ time: new Date().toISOString(), level, message, ...(data ? { data } : {}) }) + '\n';
    pending = pending.then(() => append(line)).catch(error => console.error('file logger error:', error.message));
    console[level === 'error' ? 'error' : 'log'](line.trim());
  }
  return { info: (m, d) => write('info', m, d), warn: (m, d) => write('warn', m, d), error: (m, d) => write('error', m, d), flush: () => pending };
}
module.exports = { createLogger };
