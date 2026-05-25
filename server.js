import http from 'http';
import { formatUptime } from './utils/format.js';
import { createLogger } from './utils/logger.js';
import { config } from './config.js';

const log = createLogger('HTTP');

const botState = {
  connection: 'disconnected',
  retryCount: 0,
  maxRetries: 10,
  isReconnecting: false,
  isRestarting: false,
  lastDisconnectReason: null,
  lastConnectedAt: null,
  messagesProcessed: 0,
  messagesError: 0,
  startedAt: Date.now(),
  pool: null,
};

export function setBotState(patch) {
  Object.assign(botState, patch);
}

export function getBotState() {
  return botState;
}

export function incrementMessages(success = true) {
  if (success) botState.messagesProcessed++;
  else botState.messagesError++;
}

function buildPayload(getVersion) {
  const now = Date.now();
  const uptimeSec = Math.floor((now - botState.startedAt) / 1000);

  let poolStats = null;
  if (botState.pool) {
    try {
      const p = botState.pool.pool;
      const total   = p._allConnections.length;
      const free    = p._freeConnections.length;
      const waiting = p._connectionQueue.length;
      poolStats = {
        total,
        used:    total - free,
        idle:    free,
        waiting,
      };
    } catch {
      poolStats = { error: 'stats unavailable' };
    }
  }

  return {
    status: botState.connection === 'open' ? 'online' : 'offline',
    connection: botState.connection,
    waVersion: getVersion().length ? getVersion().join('.') : 'unknown',
    uptime: {
      formatted: formatUptime(uptimeSec),
      seconds: uptimeSec,
    },
    reconnect: {
      retryCount: botState.retryCount,
      maxRetries: botState.maxRetries,
      isReconnecting: botState.isReconnecting,
      lastReason: botState.lastDisconnectReason,
    },
    messages: {
      processed: botState.messagesProcessed,
      errors: botState.messagesError,
    },
    lastConnectedAt: botState.lastConnectedAt,
    timestamp: new Date().toISOString(),
    database: poolStats,
  };
}

const ROUTES = {
  '/': (getVersion) => buildPayload(getVersion),
  '/health': () => ({
    status: botState.connection === 'open' ? 'ok' : 'degraded',
    connection: botState.connection,
    uptime: Math.floor((Date.now() - botState.startedAt) / 1000),
    timestamp: new Date().toISOString(),
  }),
  '/stats': (getVersion) => buildPayload(getVersion),
};

export function createHttpServer(getVersion) {
  const server = http.createServer((req, res) => {
    const url = req.url?.split('?')[0] ?? '/';
    const handler = ROUTES[url];

    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found', routes: Object.keys(ROUTES) }));
      return;
    }

    try {
      const body = JSON.stringify(handler(getVersion), null, 2);
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      });
      res.end(body);
    } catch (err) {
      log.error('Request error', { url, detail: err.message });
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error', detail: err.message }));
    }
  });

  const PORT = config.server.port;

  server.listen(PORT, () =>
    log.info(`HTTP server on port ${PORT}`, { routes: Object.keys(ROUTES).join(', ') }),
  );

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      log.fatal(`Port ${PORT} already in use — exiting`);
      process.exit(1);
    } else {
      log.error('HTTP server error', { detail: err.message });
    }
  });

  return server;
}