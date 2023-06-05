import path, { join } from 'path';
import fs from 'fs';
import os from 'os';
import Sink from '@eik/sink';

/**
 * Configuration object
 * @typedef {import('@eik/sink')} Sink
 * @typedef Config
 * @type {object}
 * @property {string} name - Name of the application
 * @property {('development' | 'production')} env - Applicaton environments
 * @property {boolean} metrics - Enable metrics
 * @property {object} log - Log configuration
 * @property {('trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal')} log.level - Log level to log at
 * @property {object} http - Http configuration
 * @property {boolean} http.http2 - Enable http2 for the server
 * @property {string} http.address - The address the http server should bind to
 * @property {number} http.port - The port the http server should bind to
 * @property {object} compression - Compression configuration
 * @property {boolean} compression.global - Enable global compression for all http routes
 * @property {object} jwt - JWT configuration
 * @property {string} jwt.secret - Secret used for JWT signing
 * @property {object} basicAuth - Basic auth configuration
 * @property {('key' | 'disabled')} basicAuth.type - Type of basic auth to use
 * @property {string} basicAuth.key - Key used for basic authorization
 * @property {object} organization - Organization configuration
 * @property {string} organization.name - Organization name - Used as a folder name in the storage of files
 * @property {Array.<string>} organization.hostnames - Hostnames the organization maps to
 * @property {object | Sink} sink - Sink configuration
 * @property {('fs' | 'mem' | 'test')} sink.type - Type of sink to use
 * @property {string} sink.path - Absolute path to store files in when using the "fs" sink
 * @property {string} notFoundCacheControl - Cache control header value for 404 responses
 * @property {string} aliasCacheControl - Cache control header value for alias responses
 */

const CWD = process.cwd();

let pack = {};
try {
    pack = JSON.parse(fs.readFileSync(join(CWD, 'package.json')));
} catch (error) {
    /* empty */
}

/**
 * @param {Config} config
 * @returns {Config}
 */
const withDefaults = (config) => ({
    name: pack.name,
    env: 'development',
    metrics: true,
    notFoundCacheControl: 'public, max-age=5',
    aliasCacheControl: '',

    ...config,

    log: {
        level: 'info',
        ...config.log,
    },
    http: {
        http2: false,
        address: 'localhost',
        port: 4001,
        ...config.http,
    },
    compression: {
        global: true,
        ...config.compression,
    },
    jwt: {
        secret: 'change_me',
        expire: '60d',
        ...config.jwt,
    },
    basicAuth: {
        type: 'key',
        key: 'change_me',
        ...config.basicAuth,
    },
    organization: {
        name: 'local',
        hostnames: ['localhost', '127.0.0.1'],
        ...config.organization,
    },
    sink:
        config.sink instanceof Sink
            ? config.sink
            : {
                  type: 'fs',
                  path: path.join(os.tmpdir(), '/eik'),
                  ...config.sink,
              },
});

const DefaultConfig = withDefaults({});

export { DefaultConfig, withDefaults };
