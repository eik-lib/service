import { Writable, Readable } from 'node:stream';
import { ReadFile } from '@eik/common';
import Metrics from '@metrics/client';
import Sink from '@eik/sink';
import mime from 'mime';
import path from 'node:path';
import Entry from './mem-entry.js';

function toUrlPathname(pathname) {
    return pathname.replace(/\\/g, '/');
}

const DEFAULT_ROOT_PATH = '/eik';

const counterMetric = {
    name: 'eik_core_sink_test',
    description: 'Counter measuring access to the in memory test storage sink',
    labels: {
        operation: 'n/a',
        success: false,
        access: false,
    },
};

/**
 * @deprecated Use eik/sink-memory or implement your own. This class will be removed in a future version of core.
 */
export default class SinkTest extends Sink {
    constructor({ rootPath = DEFAULT_ROOT_PATH } = {}) {
        super();
        this._rootPath = rootPath;
        this._metrics = new Metrics();
        this._state = new Map();

        this._counter = this._metrics.counter(counterMetric);

        // eslint-disable-next-line no-unused-vars
        this._writeDelayResolve = (a) => -1;
        // eslint-disable-next-line no-unused-vars
        this._writeDelayChunks = (a) => -1;
    }

    get metrics() {
        return this._metrics;
    }

    set(filePath, payload) {
        const pathname = toUrlPathname(path.join(this._rootPath, filePath));
        const mimeType = mime.getType(pathname) || 'application/octet-stream';

        let entry;

        if (Array.isArray(payload)) {
            entry = new Entry({ mimeType, payload });
        } else {
            entry = new Entry({ mimeType, payload: [payload] });
        }

        this._state.set(pathname, entry);
    }

    get(filePath) {
        const pathname = toUrlPathname(path.join(this._rootPath, filePath));
        if (this._state.has(pathname)) {
            const entry = this._state.get(pathname);
            return entry.payload.join('');
        }
        return null;
    }

    dump() {
        return Array.from(this._state.entries());
    }

    clear() {
        this._state.clear();
        this._counter.removeAllListeners();
        this._metrics.destroy();

        this._metrics = new Metrics();
        this._state = new Map();

        this._counter = this._metrics.counter(counterMetric);

        // eslint-disable-next-line no-unused-vars
        this._writeDelayResolve = (a) => -1;
        // eslint-disable-next-line no-unused-vars
        this._writeDelayChunks = (a) => -1;
    }

    load(items) {
        if (!Array.isArray(items)) {
            throw new Error('Argument "items" must be an Array');
        }
        this._state = new Map(items);
    }

    /**
     * @param {(count: number) => number} fn
     */
    set writeDelayResolve(fn) {
        if (typeof fn !== 'function') {
            throw new TypeError('Value must be a function');
        }
        this._writeDelayResolve = fn;
    }

    /**
     * @param {(count: number) => number} fn
     */
    set writeDelayChunks(fn) {
        if (typeof fn !== 'function') {
            throw new TypeError('Value must be a function');
        }
        this._writeDelayChunks = fn;
    }

    // Common SINK API

    write(filePath, contentType) {
        return new Promise((resolve, reject) => {
            const operation = 'write';

            try {
                Sink.validateFilePath(filePath);
                Sink.validateContentType(contentType);
            } catch (error) {
                this._counter.inc({ labels: { operation } });
                reject(error);
                return;
            }

            const pathname = toUrlPathname(path.join(this._rootPath, filePath));

            if (pathname.indexOf(this._rootPath) !== 0) {
                this._counter.inc({ labels: { operation } });
                reject(new Error(`Directory traversal - ${filePath}`));
                return;
            }

            const chunkDelay = this._writeDelayChunks;
            const payload = [];
            let count = 0;
            const stream = new Writable({
                write(chunk, encoding, cb) {
                    const timeout = chunkDelay(count);
                    count += 1;

                    if (timeout < 0) {
                        payload.push(chunk);
                        cb();
                    } else {
                        setTimeout(() => {
                            payload.push(chunk);
                            cb();
                        }, timeout);
                    }
                },
            });

            stream.on('finish', () => {
                const entry = new Entry({
                    mimeType: contentType,
                    payload,
                });

                this._state.set(pathname, entry);

                this._counter.inc({
                    labels: {
                        success: true,
                        access: true,
                        operation,
                    },
                });
            });

            const resolveDelay = this._writeDelayResolve();
            if (resolveDelay < 0) {
                resolve(stream);
            } else {
                setTimeout(() => {
                    resolve(stream);
                }, resolveDelay);
            }
        });
    }

    read(filePath) {
        return new Promise((resolve, reject) => {
            const operation = 'read';

            try {
                Sink.validateFilePath(filePath);
            } catch (error) {
                this._counter.inc({ labels: { operation } });
                reject(error);
                return;
            }

            const pathname = toUrlPathname(path.join(this._rootPath, filePath));

            if (pathname.indexOf(this._rootPath) !== 0) {
                this._counter.inc({ labels: { operation } });
                reject(new Error(`Directory traversal - ${filePath}`));
                return;
            }

            const entry = this._state.get(pathname);
            const payload = entry.payload || [];
            const file = new ReadFile({
                mimeType: entry.mimeType,
                etag: entry.hash,
            });

            file.stream = new Readable({
                read() {
                    payload.forEach((item) => {
                        this.push(item);
                    });
                    this.push(null);
                },
            });

            file.stream.on('end', () => {
                this._counter.inc({
                    labels: {
                        success: true,
                        access: true,
                        operation,
                    },
                });
            });

            resolve(file);
        });
    }

    delete(filePath) {
        return new Promise((resolve, reject) => {
            const operation = 'delete';

            try {
                Sink.validateFilePath(filePath);
            } catch (error) {
                this._counter.inc({ labels: { operation } });
                reject(error);
                return;
            }

            const pathname = toUrlPathname(path.join(this._rootPath, filePath));

            if (pathname.indexOf(this._rootPath) !== 0) {
                this._counter.inc({ labels: { operation } });
                reject(new Error(`Directory traversal - ${filePath}`));
                return;
            }

            // Delete recursively
            Array.from(this._state.keys()).forEach((key) => {
                if (key.startsWith(pathname)) {
                    this._state.delete(key);
                }
            });

            this._counter.inc({
                labels: {
                    success: true,
                    access: true,
                    operation,
                },
            });

            resolve();
        });
    }

    exist(filePath) {
        return new Promise((resolve, reject) => {
            const operation = 'exist';

            try {
                Sink.validateFilePath(filePath);
            } catch (error) {
                this._counter.inc({ labels: { operation } });
                reject(error);
                return;
            }

            const pathname = toUrlPathname(path.join(this._rootPath, filePath));

            if (pathname.indexOf(this._rootPath) !== 0) {
                this._counter.inc({ labels: { operation } });
                reject(new Error(`Directory traversal - ${filePath}`));
                return;
            }

            this._counter.inc({
                labels: {
                    success: true,
                    access: true,
                    operation,
                },
            });

            if (this._state.has(pathname)) {
                resolve();
                return;
            }
            reject(new Error('File does not exist'));
        });
    }

    get [Symbol.toStringTag]() {
        return 'SinkTest';
    }
}
