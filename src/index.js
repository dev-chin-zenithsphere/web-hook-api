require('dotenv').config(); const { loadConfig, validateConfig } = require('./config'); const { createLogger } = require('./logger'); const { createGateway } = require('./app');
try {
  const config = validateConfig(loadConfig()); const logger = createLogger(config.log); const gateway = createGateway(config, logger);
  const http = gateway.app.listen(config.http.port, config.http.host, () => logger.info('HTTP API listening', { host: config.http.host, port: config.http.port, mode: config.mode }));
  http.on('error', error => { logger.error('HTTP server error', { error: error.message }); process.exitCode = 1; });
  gateway.transport.start();
  let stopping = false;
  const stop = async signal => {
    if (stopping) return; stopping = true;
    logger.info('shutdown started', { signal }); gateway.transport.stop();
    const drained = await gateway.webhook.drainBefore(config.shutdown.webhookDrainTimeoutMs);
    logger.info('webhook drain completed', { drained });
    http.close(async () => { await logger.flush(); process.exit(0); });
  };
  process.on('SIGINT', () => void stop('SIGINT')); process.on('SIGTERM', () => void stop('SIGTERM'));
} catch (error) { console.error(error.message); process.exitCode = 1; }
