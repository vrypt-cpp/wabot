const RESET = '\x1b[0m';

const COLORS = {
  dim:     '\x1b[2m',
  gray:    '\x1b[90m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  magenta: '\x1b[35m',
  white:   '\x1b[37m',
  bgRed:   '\x1b[41m',
};

const c = (color, text) => `${COLORS[color]}${text}${RESET}`;

const LEVELS = {
  10: { label: 'TRACE', fn: (t) => c('gray', t) },
  20: { label: 'DEBUG', fn: (t) => c('cyan', t) },
  30: { label: 'INFO',  fn: (t) => c('green', t) },
  40: { label: 'WARN',  fn: (t) => c('yellow', t) },
  50: { label: 'ERROR', fn: (t) => c('red', t) },
  60: { label: 'FATAL', fn: (t) => `${COLORS.bgRed}${t}${RESET}` },
};

const LOG_LEVEL_MAP = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 };
const MIN_LEVEL = LOG_LEVEL_MAP[process.env.LOG_LEVEL?.toLowerCase()] ?? 30;

function formatTime() {
  return c('dim', new Date().toLocaleTimeString('id-ID', { hour12: false }));
}

function formatLevel(level) {
  const entry = LEVELS[level] ?? { label: `LVL${level}`, fn: (t) => t };
  return entry.fn(`[${entry.label}]`);
}

function formatTag(tag) {
  return tag ? c('magenta', `[${tag}]`) : '';
}

function formatExtra(obj, level) {
  if (!obj || !Object.keys(obj).length) return '';
  if (level < 40) return c('dim', `{${Object.keys(obj).join(', ')}}`);
  try {
    return c('dim', JSON.stringify(obj));
  } catch {
    return c('dim', '[unstringifiable]');
  }
}

function print(level, tag, msg, extra) {
  if (level < MIN_LEVEL) return;

  const parts = [
    formatTime(),
    formatLevel(level),
    formatTag(tag),
    c('white', msg),
    formatExtra(extra, level),
  ].filter(Boolean).join(' ');

  if (level >= 50) console.error(parts);
  else if (level >= 40) console.warn(parts);
  else console.log(parts);
}

export function createLogger(tag = '') {
  return {
    trace: (msg, extra = {}) => print(10, tag, msg, extra),
    debug: (msg, extra = {}) => print(20, tag, msg, extra),
    info:  (msg, extra = {}) => print(30, tag, msg, extra),
    warn:  (msg, extra = {}) => print(40, tag, msg, extra),
    error: (msg, extra = {}) => print(50, tag, msg, extra),
    fatal: (msg, extra = {}) => print(60, tag, msg, extra),
  };
}

export const logger = createLogger();

const COLORS = {
  dim:     '\x1b[2m',
  gray:    '\x1b[90m',
  cyan:    '\x1b[36m',
  green:   '\x1b[32m',
  yellow:  '\x1b[33m',
  red:     '\x1b[31m',
  magenta: '\x1b[35m',
  white:   '\x1b[37m',
  bgRed:   '\x1b[41m',
};

const c = (color, text) => `${COLORS[color]}${text}${RESET}`;

const LEVELS = {
  10: { label: 'TRACE', fn: (t) => c('gray', t) },
  20: { label: 'DEBUG', fn: (t) => c('cyan', t) },
  30: { label: 'INFO',  fn: (t) => c('green', t) },
  40: { label: 'WARN',  fn: (t) => c('yellow', t) },
  50: { label: 'ERROR', fn: (t) => c('red', t) },
  60: { label: 'FATAL', fn: (t) => `${COLORS.bgRed}${t}${RESET}` },
};

function formatTime() {
  return c('dim', new Date().toLocaleTimeString('id-ID', { hour12: false }));
}

function formatLevel(level) {
  const entry = LEVELS[level] ?? { label: `LVL${level}`, fn: (t) => t };
  return entry.fn(`[${entry.label}]`);
}

function formatTag(tag) {
  return tag ? c('magenta', `[${tag}]`) : '';
}

function formatExtra(obj) {
  if (!obj || !Object.keys(obj).length) return '';
  return c('dim', JSON.stringify(obj, null, 2));
}

function print(level, tag, msg, extra) {
  const parts = [
    formatTime(),
    formatLevel(level),
    formatTag(tag),
    c('white', msg),
    formatExtra(extra),
  ].filter(Boolean).join(' ');

  if (level >= 50) console.error(parts);
  else if (level >= 40) console.warn(parts);
  else console.log(parts);
}

export function createLogger(tag = '') {
  return {
    trace: (msg, extra = {}) => print(10, tag, msg, extra),
    debug: (msg, extra = {}) => print(20, tag, msg, extra),
    info:  (msg, extra = {}) => print(30, tag, msg, extra),
    warn:  (msg, extra = {}) => print(40, tag, msg, extra),
    error: (msg, extra = {}) => print(50, tag, msg, extra),
    fatal: (msg, extra = {}) => print(60, tag, msg, extra),
  };
}

export const logger = createLogger();