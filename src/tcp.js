const net = require('node:net');
function createTransport(config, logger, onFrame, onRaw) {
  let server; let socket; let reconnectTimer; let connecting = false; let accepted = 0; let reconnectAttempt = 0;
  const state = { status: 'stopped', connections: 0, lastError: null, frames: 0, overflow: 0, listenPort: null };
  function bind(s) {
    let buffer = Buffer.alloc(0); state.connections++;
    s.on('data', data => {
      const exceedsLimit = data.length > config.framing.maxReceiveBufferBytes || buffer.length + data.length > config.framing.maxReceiveBufferBytes;
      onRaw(data, { exceedsLimit });
      if (exceedsLimit) { state.overflow++; logger.warn('receive buffer limit exceeded; dropping buffered data', { bytes: buffer.length + data.length }); buffer = Buffer.alloc(0); return; }
      buffer = Buffer.concat([buffer, data]);
      const delimiter = Buffer.from(config.framing.delimiter, config.encoding); let index;
      while ((index = buffer.indexOf(delimiter)) !== -1) { const frame = buffer.subarray(0, index); buffer = buffer.subarray(index + delimiter.length); state.frames++; onFrame(frame); }
    });
    s.on('error', e => { state.lastError = e.message; logger.warn('TCP socket error', { error: e.message }); });
    s.on('close', () => { state.connections = Math.max(0, state.connections - 1); if (config.role === 'server') accepted = Math.max(0, accepted - 1); if (config.role === 'client') scheduleReconnect(); });
  }
  function scheduleReconnect() { if (reconnectTimer || state.status === 'stopped') return; state.status = 'reconnecting'; const delay = Math.min(config.reconnectDelayMs * (2 ** reconnectAttempt++), config.maxReconnectDelayMs || config.reconnectDelayMs); reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, delay); }
  function connect() { if (connecting || socket || state.status === 'stopped') return; connecting = true; state.status = 'connecting'; const s = net.createConnection({ host: config.host, port: config.port }); socket = s;
    const connectTimer = setTimeout(() => s.destroy(new Error('connect timeout')), config.connectTimeoutMs);
    s.once('connect', () => {
      clearTimeout(connectTimer); connecting = false; reconnectAttempt = 0; state.status = 'connected';
      if (config.idleTimeoutMs) s.setTimeout(config.idleTimeoutMs, () => s.destroy(new Error('idle timeout')));
    });
    s.once('close', () => clearTimeout(connectTimer));
    s.once('close', () => { if (socket === s) socket = null; connecting = false; }); bind(s);
  }
  return { start() { state.status = 'starting'; if (config.role === 'client') connect(); else { server = net.createServer(s => { if (config.serverConnectionPolicy === 'single-reject' && accepted > 0) { logger.warn('TCP connection rejected by single-reject policy'); s.destroy(); return; } accepted++; bind(s); }); server.on('error', e => { state.lastError = e.message; }); server.listen(config.port, config.host, () => { state.status = 'listening'; state.listenPort = server.address().port; }); } }, stop() { state.status = 'stopped'; if (reconnectTimer) clearTimeout(reconnectTimer); if (socket) socket.destroy(); if (server) server.close(); }, status: () => ({ ...state }) };
}
module.exports = { createTransport };
