const crypto = require('node:crypto');
const wait = ms => new Promise(r => setTimeout(r, ms));
function createWebhookSender(config, logger, counters) {
  const queue = []; let active = false; let accepting = true;
  async function deliver(event) {
    for (let attempt = 0; attempt <= config.retry; attempt++) {
      const body = JSON.stringify(event); const headers = { 'content-type': 'application/json', 'x-event-id': event.eventId };
      if (process.env.WEBHOOK_SECRET) headers['x-webhook-signature'] = `sha256=${crypto.createHmac('sha256', process.env.WEBHOOK_SECRET).update(body).digest('hex')}`;
      try { const response = await fetch(config.url, { method: 'POST', headers, body, signal: AbortSignal.timeout(config.timeoutMs) }); if (response.ok) { counters.webhookDelivered++; return; } throw new Error(`HTTP ${response.status}`); }
      catch (error) { if (attempt === config.retry) { counters.webhookFailed++; logger.error('webhook delivery failed', { eventId: event.eventId, attempts: attempt + 1, error: error.message }); return; } counters.webhookRetries++; await wait(config.retryDelayMs); }
    }
  }
  async function drain() { if (active) return; active = true; while (queue.length) await deliver(queue.shift()); active = false; }
  async function drainBefore(timeoutMs) {
    accepting = false; const deadline = Date.now() + timeoutMs;
    while ((active || queue.length) && Date.now() < deadline) await wait(25);
    return !active && queue.length === 0;
  }
  return {
    enqueue(event) {
      if (!config.enabled) return;
      if (!accepting) { counters.webhookDropped++; logger.error('webhook sender is stopping; completed result not enqueued', { eventId: event.eventId }); return; }
      if (queue.length >= config.maxQueueSize) { counters.webhookDropped++; logger.error('webhook queue full; completed result not enqueued', { eventId: event.eventId, maxQueueSize: config.maxQueueSize }); return; }
      queue.push(event); counters.webhookQueued++; void drain();
    },
    drainBefore,
    status: () => ({ queued: queue.length, active, accepting })
  };
}
module.exports = { createWebhookSender };
