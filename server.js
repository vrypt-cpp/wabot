import http from 'http';
import os from 'os';
import { formatUptime } from './utils/format.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

const toMB = (bytes) => (bytes / 1024 / 1024).toFixed(2);
const toGB = (bytes) => (bytes / 1024 / 1024 / 1024).toFixed(2);
const pct  = (used, total) => ((used / total) * 100).toFixed(1);

function getCpuInfo() {
  const cpus = os.cpus();
  if (!cpus.length) return null;

  const model   = cpus[0].model.trim();
  const cores   = cpus.length;
  const speedMHz = cpus[0].speed;

  // Aggregate all core times
  let totalIdle = 0, totalTick = 0;
  for (const cpu of cpus) {
    const times = cpu.times;
    const tick  = times.user + times.nice + times.sys + times.idle + times.irq;
    totalTick += tick;
    totalIdle += times.idle;
  }

  const usagePct = (((totalTick - totalIdle) / totalTick) * 100).toFixed(1);

  return { model, cores, speedMHz, usagePct: `${usagePct}%` };
}

function getMemoryInfo() {
  const mem    = process.memoryUsage();
  const total  = os.totalmem();
  const free   = os.freemem();
  const used   = total - free;

  return {
    // Process-level
    heapUsed:     `${toMB(mem.heapUsed)} MB`,
    heapTotal:    `${toMB(mem.heapTotal)} MB`,
    heapPct:      `${pct(mem.heapUsed, mem.heapTotal)}%`,
    rss:          `${toMB(mem.rss)} MB`,
    external:     `${toMB(mem.external)} MB`,
    arrayBuffers: `${toMB(mem.arrayBuffers ?? 0)} MB`,
    // System-level
    systemTotal:  `${toGB(total)} GB`,
    systemUsed:   `${toGB(used)} GB`,
    systemFree:   `${toGB(free)} GB`,
    systemPct:    `${pct(used, total)}%`,
  };
}

function getNetworkInfo() {
  const ifaces = os.networkInterfaces();
  const result = {};

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    result[name] = addrs
      .filter((a) => !a.internal)
      .map(({ address, family, netmask, mac }) => ({
        address, family, netmask, mac,
      }));
    if (!result[name].length) delete result[name];
  }

  return result;
}

function getLoadAvg() {
  const [m1, m5, m15] = os.loadavg();
  return {
    '1m':  m1.toFixed(2),
    '5m':  m5.toFixed(2),
    '15m': m15.toFixed(2),
  };
}

function getOsInfo() {
  return {
    platform:     process.platform,
    arch:         process.arch,
    release:      os.release(),
    type:         os.type(),
    hostname:     os.hostname(),
    nodeVersion:  process.version,
    v8Version:    process.versions.v8,
    pid:          process.pid,
    ppid:         process.ppid,
    execPath:     process.execPath,
    cwd:          process.cwd(),
    title:        process.title,
  };
}

function getEventLoopInfo() {
  // Approximate event loop lag via a synchronous delta trick
  const start = process.hrtime.bigint();
  setImmediate(() => {}); // yield, but we measure sync cost only
  const elapsedNs = Number(process.hrtime.bigint() - start);
  return {
    lagNs:  elapsedNs,
    lagMs:  (elapsedNs / 1e6).toFixed(3),
  };
}

function getGcInfo() {
  // Available when --expose-gc flag is set; gracefully omit otherwise
  if (typeof global.gc === 'function') {
    return { gcExposed: true, hint: 'Call GET /gc to trigger manual GC' };
  }
  return { gcExposed: false };
}

function buildPayload(getVersion) {
  const now = new Date();
  return {
    // ── Identity ───────────────────────────────────────────────────────────
    status:      'ok',
    version:     getVersion().join('.'),
    timestamp:   now.toISOString(),
    timestampMs: now.getTime(),

    // ── Process uptime ─────────────────────────────────────────────────────
    uptime: {
      formatted: formatUptime(process.uptime()),
      seconds:   Math.floor(process.uptime()),
    },

    // ── OS / Runtime ───────────────────────────────────────────────────────
    os:      getOsInfo(),
    cpu:     getCpuInfo(),
    loadAvg: getLoadAvg(),

    // ── Memory ─────────────────────────────────────────────────────────────
    memory: getMemoryInfo(),

    // ── Event loop ─────────────────────────────────────────────────────────
    eventLoop: getEventLoopInfo(),

    // ── GC ─────────────────────────────────────────────────────────────────
    gc: getGcInfo(),

    // ── Network ────────────────────────────────────────────────────────────
    network: getNetworkInfo(),

    // ── Environment ────────────────────────────────────────────────────────
    env: {
      NODE_ENV: process.env.NODE_ENV ?? 'undefined',
      PORT:     process.env.PORT ?? '3000',
      TZ:       process.env.TZ ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };
}

// ─── Route handlers ─────────────────────────────────────────────────────────

const ROUTES = {
  '/': (getVersion) => ({ ...buildPayload(getVersion) }),

  '/health': () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
  }),

  '/memory': () => ({ memory: getMemoryInfo() }),
  '/cpu':    () => ({ cpu: getCpuInfo(), loadAvg: getLoadAvg() }),
  '/os':     () => ({ os: getOsInfo() }),
  '/network':() => ({ network: getNetworkInfo() }),

  '/gc': () => {
    if (typeof global.gc === 'function') {
      global.gc();
      return { gc: 'triggered', memory: getMemoryInfo() };
    }
    return { gc: 'unavailable', hint: 'Start Node with --expose-gc' };
  },
};

// ─── Server factory ──────────────────────────────────────────────────────────

export function createHttpServer(getVersion) {
  const server = http.createServer((req, res) => {
    const url     = req.url?.split('?')[0] ?? '/';
    const handler = ROUTES[url];

    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error:  'Not Found',
        routes: Object.keys(ROUTES),
      }));
      return;
    }

    try {
      const body = JSON.stringify(handler(getVersion), null, 2);
      res.writeHead(200, {
        'Content-Type':  'application/json',
        'Cache-Control': 'no-store',
        'X-Powered-By':  `Node/${process.version}`,
      });
      res.end(body);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error', detail: err.message }));
    }
  });

  const PORT = Number(process.env.PORT) || 3000;

  server.listen(PORT, () =>
    console.log(`✅ HTTP server on port ${PORT}  |  routes: ${Object.keys(ROUTES).join('  ')}`),
  );

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`❌ Port ${PORT} already in use — exiting`);
      process.exit(1);
    } else {
      console.error('HTTP server error:', err);
    }
  });

  return server;
}
