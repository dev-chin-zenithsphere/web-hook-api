const fs = require('node:fs'); const path = require('node:path');
function loadConfig(file = path.resolve(process.cwd(), 'config.json')) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function validateConfig(c, env = process.env) {
  const errors = []; const tcp = c.tcp || {}; const wh = c.webhook || {};
  const positiveInteger = value => Number.isInteger(value) && value > 0;
  if (!['mock', 'real'].includes(c.mode)) errors.push('mode must be mock or real');
  if (!c.http || !c.http.host || !Number.isInteger(c.http.port) || c.http.port < 1 || c.http.port > 65535) errors.push('http.host and integer http.port from 1 to 65535 are required');
  if (c.http && !['127.0.0.1', 'localhost', '::1'].includes(c.http.host) && !env.API_KEY) errors.push('API_KEY environment variable is required when HTTP is exposed beyond localhost');
  if (!['client', 'server'].includes(tcp.role)) errors.push('tcp.role must be client or server');
  if (!Number.isInteger(tcp.port) || tcp.port < 1 || tcp.port > 65535) errors.push('tcp.port must be an integer from 1 to 65535');
  if (!tcp.host) errors.push('tcp.host is required');
  if (!tcp.framing || typeof tcp.framing.delimiter !== 'string' || !tcp.framing.delimiter.length || !positiveInteger(tcp.framing.maxReceiveBufferBytes)) errors.push('tcp.framing requires a non-empty delimiter and positive maxReceiveBufferBytes');
  if (!positiveInteger(tcp.connectTimeoutMs) || !positiveInteger(tcp.reconnectDelayMs) || !positiveInteger(tcp.maxReconnectDelayMs) || tcp.maxReconnectDelayMs < tcp.reconnectDelayMs) errors.push('tcp connect/reconnect timeout values must be positive integers and maxReconnectDelayMs must not be lower than reconnectDelayMs');
  if (tcp.idleTimeoutMs !== null && tcp.idleTimeoutMs !== undefined && !positiveInteger(tcp.idleTimeoutMs)) errors.push('tcp.idleTimeoutMs must be null or a positive integer');
  if (!['single-reject'].includes(tcp.serverConnectionPolicy)) errors.push('tcp.serverConnectionPolicy must be single-reject');
  if (c.mode === 'real') errors.push('real mode is refused: no verified Anritsu Ethernet Text Specifications adapter is installed. Required: framing, encoding, field grammar, OK/NG mapping, TCP role/port and any required commands.');
  if (c.mode === 'mock' && tcp.adapter !== 'simulator-line-v1') errors.push('mock mode supports only adapter simulator-line-v1');
  if (wh.enabled && (!wh.url || !/^https?:\/\//.test(wh.url))) errors.push('webhook.url must be an http(s) URL when webhook is enabled');
  if (!positiveInteger(wh.timeoutMs) || !Number.isInteger(wh.retry) || wh.retry < 0 || !positiveInteger(wh.retryDelayMs) || !positiveInteger(wh.maxQueueSize)) errors.push('webhook timeout, retryDelayMs and maxQueueSize must be positive; retry must be zero or greater');
  if (!positiveInteger(c.storage && c.storage.maxResults)) errors.push('storage.maxResults must be a positive integer');
  if (!c.log || typeof c.log.path !== 'string' || !c.log.path || !positiveInteger(c.log.maxBytes)) errors.push('log.path and positive log.maxBytes are required');
  if (!c.shutdown || !positiveInteger(c.shutdown.webhookDrainTimeoutMs)) errors.push('shutdown.webhookDrainTimeoutMs must be a positive integer');
  if (!tcp.captureRaw || !['hex', 'base64'].includes(tcp.captureRaw.format) || !positiveInteger(tcp.captureRaw.maxCaptureBytes)) errors.push('tcp.captureRaw requires format hex/base64 and positive maxCaptureBytes');
  if (errors.length) throw new Error(`Invalid configuration:\n- ${errors.join('\n- ')}`);
  return c;
}
module.exports = { loadConfig, validateConfig };
