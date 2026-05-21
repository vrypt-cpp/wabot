import { readdir, watch } from 'fs/promises';
import { pathToFileURL } from 'url';
import { join, basename } from 'path';
import { createLogger } from './utils/logger.js';

const log = createLogger('LOADER');

export class CommandRegistry {
  constructor() {
    this._commands = new Map();
    this._fileToNames = new Map();
    this._watchDir = null;
  }

  register(meta, filePath) {
    const names = Array.isArray(meta.name) ? meta.name : [meta.name];
    for (const name of names) {
      if (this._commands.has(name)) log.warn(`Duplicate "${name}" — overwriting`);
      this._commands.set(name.toLowerCase(), meta);
    }
    if (filePath) this._fileToNames.set(filePath, names.map(n => n.toLowerCase()));
    log.info(`Registered: ${names.join(', ')}`);
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
      if (!meta || typeof meta.execute !== 'function') {
        log.warn(`Skipping ${basename(filePath)}: no valid default export`);
        return null;
      }
      return meta;
    } catch (err) {
      log.error(`Failed to load ${basename(filePath)}: ${err.message}`);
      return null;
    }
  }

  async loadDir(dir) {
    this._watchDir = dir;
    let files;
    try {
      files = await readdir(dir);
    } catch {
      log.error(`Cannot read: ${dir}`);
      return;
    }
    const jsFiles = files.filter(f => f.endsWith('.js'));
    log.info(`Loading ${jsFiles.length} plugin(s) from ${dir}`);
    for (const file of jsFiles) {
      const filePath = join(dir, file);
      const meta = await this._importFile(filePath);
      if (meta) this.register(meta, filePath);
    }
  }

  async watch(dir, notify) {
    const watchDir = dir ?? this._watchDir;
    if (!watchDir) throw new Error('Call loadDir() before watch().');
    log.info(`Watching ${watchDir}...`);

    const debounce = new Map();

    const handle = async (event, filename) => {
      if (!filename?.endsWith('.js')) return;
      const filePath = join(watchDir, filename);

      clearTimeout(debounce.get(filePath));
      debounce.set(filePath, setTimeout(async () => {
        debounce.delete(filePath);

        const exists = await readdir(watchDir)
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

    const watcher = await watch(watchDir, { persistent: false });
    for await (const { eventType, filename } of watcher) {
      handle(eventType, filename);
    }
  }

  find(name) {
    return this._commands.get(name.toLowerCase());
  }

  all() {
    return [...new Set(this._commands.values())];
  }
}
