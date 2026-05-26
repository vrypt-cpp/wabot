import { readdir, watch } from 'fs/promises';
import { pathToFileURL } from 'url';
import { join, basename } from 'path';
import { createLogger } from './utils/logger.js';
import { config } from './config.js';

const log = createLogger('LOADER');

const HOT_RELOAD_ENABLED = process.env.HOT_RELOAD === 'true';

const VALID_CATEGORIES = ['utility', 'fun', 'admin', 'info', 'media', 'moderation'];
const VALID_SCOPES = ['all', 'group', 'private'];

const COOLDOWN_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

export class CommandRegistry {
  constructor() {
    this._commands = new Map();
    this._fileToNames = new Map();
    this._watchDir = null;
    this._cooldowns = new Map();
    this._watcherAbort = null;

    this._cleanupTimer = setInterval(() => this._purgeCooldowns(), COOLDOWN_CLEANUP_INTERVAL_MS);
    this._cleanupTimer.unref();
  }

  _purgeCooldowns() {
    const now = Date.now();
    for (const [key, expires] of this._cooldowns) {
      if (now >= expires) this._cooldowns.delete(key);
    }
  }

  destroy() {
    clearInterval(this._cleanupTimer);
    if (this._watcherAbort) {
      this._watcherAbort.abort();
      this._watcherAbort = null;
      log.info('Watcher dihentikan.');
    }
  }

  _validate(meta, filePath) {
    const file = basename(filePath);
    const required = ['name', 'execute', 'description', 'category'];
    const missing = required.filter(k => !meta[k]);

    if (missing.length) {
      log.warn(`${file} missing required fields: ${missing.join(', ')}`);
      return false;
    }

    if (typeof meta.execute !== 'function') {
      log.warn(`${file}: execute must be a function`);
      return false;
    }

    if (!VALID_CATEGORIES.includes(meta.category)) {
      log.warn(`${file}: invalid category "${meta.category}" — must be one of: ${VALID_CATEGORIES.join(', ')}`);
      return false;
    }

    if (meta.scope !== undefined && !VALID_SCOPES.includes(meta.scope)) {
      log.warn(`${file}: invalid scope "${meta.scope}" — must be: ${VALID_SCOPES.join(', ')}`);
      return false;
    }

    if (meta.ownerOnly !== undefined && typeof meta.ownerOnly !== 'boolean') {
      log.warn(`${file}: ownerOnly must be a boolean`);
      return false;
    }

    if (meta.cooldown !== undefined && (typeof meta.cooldown !== 'number' || meta.cooldown < 0)) {
      log.warn(`${file}: cooldown must be a non-negative number`);
      return false;
    }

    if (meta.hidden !== undefined && typeof meta.hidden !== 'boolean') {
      log.warn(`${file}: hidden must be a boolean`);
      return false;
    }

    return true;
  }

  _applyDefaults(meta) {
    return {
      ownerOnly: false,
      scope: 'all',
      cooldown: config.settings.defaultCooldown,
      hidden: false,
      ...meta,
    };
  }

  register(meta, filePath) {
    const names = Array.isArray(meta.name) ? meta.name : [meta.name];
    const enriched = this._applyDefaults(meta);

    for (const name of names) {
      if (this._commands.has(name.toLowerCase())) log.warn(`Duplicate "${name}" — overwriting`);
      this._commands.set(name.toLowerCase(), enriched);
    }

    if (filePath) this._fileToNames.set(filePath, names.map(n => n.toLowerCase()));
    log.info(`Registered: ${names.join(', ')} [${enriched.category}] scope=${enriched.scope} ownerOnly=${enriched.ownerOnly}`);
  }

  _unregisterFile(filePath) {
    const names = this._fileToNames.get(filePath) ?? [];
    for (const name of names) this._commands.delete(name);
    this._fileToNames.delete(filePath);
    if (names.length) log.info(`Unregistered: ${names.join(', ')} (${basename(filePath)})`);
  }

  async _importFile(filePath) {
    const url = `${pathToFileURL(filePath).href}?t=${Date.now()}`;
    try {
      const mod = await import(url);
      const meta = mod.default;

      if (!meta || !this._validate(meta, filePath)) {
        log.warn(`Skipping ${basename(filePath)}: failed validation`);
        return null;
      }

      return meta;
    } catch (err) {
      log.error(`Failed to load ${basename(filePath)}: ${err.message}`);
      return null;
    }
  }

  async loadDir(dir, isRoot = true) {
    if (isRoot) this._watchDir = dir;

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      log.error(`Cannot read: ${dir}`);
      return;
    }

    const jsFiles = entries.filter(e => e.isFile() && e.name.endsWith('.js') && !e.name.startsWith('_'));
    const subDirs = entries.filter(e => e.isDirectory() && !e.name.startsWith('_'));

    if (isRoot) log.info(`Loading plugin(s) from ${dir} (recursive)`);

    await Promise.all([
      ...jsFiles.map(async (e) => {
        const filePath = join(dir, e.name);
        const meta = await this._importFile(filePath);
        if (meta) this.register(meta, filePath);
      }),
      ...subDirs.map(e => this.loadDir(join(dir, e.name), false)),
    ]);
  }

  async watch(dir, notify) {
    if (!HOT_RELOAD_ENABLED) {
      log.info('Hot-reload dinonaktifkan (set HOT_RELOAD=true di .env untuk aktifkan). File watcher tidak dijalankan.');
      return;
    }

    const watchDir = dir ?? this._watchDir;
    if (!watchDir) throw new Error('Call loadDir() before watch().');

    if (this._watcherAbort) {
      this._watcherAbort.abort();
    }
    this._watcherAbort = new AbortController();
    const { signal } = this._watcherAbort;

    log.info(`Watching ${watchDir} (recursive)...`);

    const debounce = new Map();

    const collectDirs = async (baseDir) => {
      const result = [baseDir];
      try {
        const entries = await readdir(baseDir, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory() && !e.name.startsWith('_')) {
            result.push(...await collectDirs(join(baseDir, e.name)));
          }
        }
      } catch {}
      return result;
    };

    const handle = (baseDir, filename) => {
      if (!filename?.endsWith('.js')) return;
      const filePath = join(baseDir, filename);

      clearTimeout(debounce.get(filePath));
      debounce.set(filePath, setTimeout(async () => {
        debounce.delete(filePath);

        const exists = await readdir(baseDir)
          .then(files => files.includes(filename))
          .catch(() => false);

        if (!exists) {
          this._unregisterFile(filePath);
          log.info(`Plugin removed: ${filename}`);
          return;
        }

        this._unregisterFile(filePath);
        const meta = await this._importFile(filePath);
        if (!meta) return;

        this.register(meta, filePath);
        log.info(`Hot-reloaded: ${filename}`);

        if (notify?.sock && notify?.from) {
          const names = Array.isArray(meta.name) ? meta.name : [meta.name];
          await notify.sock.sendMessage(notify.from, {
            text: `🔄 Plugin *${names.join('/')}* reloaded (${filename})`
          }).catch(() => {});
        }
      }, 300));
    };

    const startWatcher = async (targetDir) => {
      try {
        const watcher = await watch(targetDir, { persistent: false, signal });
        for await (const { filename } of watcher) {
          if (!filename) continue;

          const fullPath = join(targetDir, filename);
          const isNewDir = await readdir(fullPath).then(() => true).catch(() => false);

          if (isNewDir && !filename.startsWith('_')) {
            log.info(`New subfolder detected: ${filename}, watching...`);
            await this.loadDir(fullPath, false);
            startWatcher(fullPath);
            continue;
          }

          handle(targetDir, filename);
        }
      } catch (err) {
        if (err.name !== 'AbortError') {
          log.error(`Watcher error (${targetDir}): ${err.message}`);
        }
      }
    };

    const allDirs = await collectDirs(watchDir);
    log.info(`Watching ${allDirs.length} dir(s)...`);
    for (const d of allDirs) {
      startWatcher(d);
    }
  }

  isOnCooldown(name, userId) {
    const key = `${name}:${userId}`;
    const expires = this._cooldowns.get(key);
    if (!expires) return false;
    if (Date.now() < expires) return true;
    this._cooldowns.delete(key);
    return false;
  }

  setCooldown(name, userId, seconds) {
    if (!seconds || seconds <= 0) return;
    this._cooldowns.set(`${name}:${userId}`, Date.now() + seconds * 1000);
  }

  find(name) {
    return this._commands.get(name.toLowerCase());
  }

  all({ includeHidden = false, category = null } = {}) {
    const unique = [...new Set(this._commands.values())];
    return unique
      .filter(cmd => includeHidden || !cmd.hidden)
      .filter(cmd => !category || cmd.category === category);
  }

  categories() {
    return [...new Set(this.all({ includeHidden: false }).map(cmd => cmd.category))];
  }
}
