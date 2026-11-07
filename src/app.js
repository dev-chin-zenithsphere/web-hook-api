const express = require('express'); const crypto = require('node:crypto'); const swaggerUi = require('swagger-ui-express'); const { createOpenApiSpec } = require('./openapi'); const { parseSimulatorLine } = require('./adapter'); const { createStore } = require('./store'); const { createWebhookSender } = require('./webhook'); const { createTransport } = require('./tcp');
function apiKeyMatches(provided, expected) {
  if (typeof provided !== 'string' || !expected) return false;
  const a = Buffer.from(provided); const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function createGateway(config, logger) {
  const store = createStore(config.storage.maxResults); const counters = { completed: 0, unparsed: 0, rawChunks: 0, webhookQueued: 0, webhookDelivered: 0, webhookFailed: 0, webhookRetries: 0, webhookDropped: 0 }; const webhook = createWebhookSender(config.webhook, logger, counters);
  function raw(data, metadata = {}) {
    counters.rawChunks++;
    if (!config.tcp.captureRaw.enabled) return;
    const maxCaptureBytes = config.tcp.captureRaw.maxCaptureBytes;
    const captured = data.subarray(0, Math.min(data.length, maxCaptureBytes));
    logger.info('raw TCP bytes captured', { format: config.tcp.captureRaw.format, originalBytes: data.length, capturedBytes: captured.length, truncated: captured.length < data.length, ...metadata, data: captured.toString(config.tcp.captureRaw.format) });
  }
  function frame(bytes) { let text; try { text = bytes.toString(config.tcp.encoding); } catch (_) { text = null; } const parsed = text === null ? { type: 'unparsed', reason: 'cannot decode configured encoding', receivedAt: new Date().toISOString() } : parseSimulatorLine(text); if (parsed.type === 'unparsed') { counters.unparsed++; store.addUnparsed(parsed); logger.warn('unparsed TCP event', { reason: parsed.reason }); return; } const result = { eventId: crypto.randomUUID(), weight: parsed.weight, unit: parsed.unit, result: parsed.result, receivedAt: parsed.receivedAt }; counters.completed++; store.addResult(result); webhook.enqueue(result); logger.info('completed weighing result received', { eventId: result.eventId, result: result.result }); }
  const transport = createTransport(config.tcp, logger, frame, raw); const app = express(); const openApiSpec = createOpenApiSpec(); const startedAt = new Date().toISOString();
  app.disable('x-powered-by');
  app.use((_, res, next) => { res.set('X-Content-Type-Options', 'nosniff'); res.set('Cache-Control', 'no-store'); next(); });
  const checkApiKey = (req, res, next) => { if (process.env.API_KEY && !apiKeyMatches(req.headers['x-api-key'], process.env.API_KEY)) return res.status(401).json({ error: 'API key required' }); return next(); };
  app.get('/health', (_, res) => res.json({ ok: true, startedAt }));
  app.get('/ready', (_, res) => {
    const tcp = transport.status(); const ready = config.tcp.role === 'server' ? tcp.status === 'listening' : tcp.status === 'connected';
    return res.status(ready ? 200 : 503).json({ ready, tcpStatus: tcp.status });
  });
  app.get('/openapi.json', (_, res) => res.json(openApiSpec));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { swaggerOptions: { persistAuthorization: true } }));
  app.use(checkApiKey);
  app.get('/api/status', (_, res) => res.json({ mode: config.mode, tcp: transport.status(), receiving: { ...counters, ...store.status() }, webhook: webhook.status() }));
  app.get('/api/results/latest', (_, res) => { const item = store.latest(); if (!item) return res.status(404).json({ message: 'No completed weighing result received yet' }); res.json(item); });
  app.get('/api/results', (req, res) => {
    const offset = req.query.offset === undefined ? 0 : Number(req.query.offset); const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    if (!Number.isInteger(offset) || offset < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100) return res.status(400).json({ error: 'offset must be a non-negative integer and limit must be an integer from 1 to 100' });
    return res.json(store.list(offset, limit));
  });
  return { app, transport, store, counters, webhook };
}
module.exports = { createGateway };
