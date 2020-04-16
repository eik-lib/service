'use strict';

const convict = require('convict');
const yaml = require('js-yaml');
const pack = require('../package.json');

convict.addParser({ extension: ['yml', 'yaml'], parse: yaml.safeLoad });

const conf = convict({
    name: {
        doc: 'Name of the apllication',
        default: pack.name,
        format: String,
    },
    env: {
        doc: 'Applicaton environments',
        format: ['development', 'stage', 'test', 'production'],
        default: 'development',
        env: 'NODE_ENV',
        arg: 'node-env',
    },
    metrics: {
        format: Boolean,
        default: true,
        env: 'METRICS',
        arg: 'metrics',
    },
    logLevel: {
        doc: 'Log level to log at',
        format: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
        default: 'info',
        env: 'LOG_LEVEL',
        arg: 'log-level',
    },
    http: {
        http2: {
            doc: 'Enable http2 for the server',
            format: Boolean,
            default: false,
            env: 'HTTP_HTTP2',
            arg: 'http-http2',
        },
        address: {
            doc: 'The address the http server should bind to',
            format: String,
            default: 'localhost',
            env: 'HTTP_ADDRESS',
            arg: 'http-address',
        },
        port: {
            doc: 'The port the http server should bind to',
            format: 'port',
            default: 4001,
            env: 'HTTP_PORT',
            arg: 'http-port',
        },
    },
    jwt: {
        secret: {
            doc: 'Secret used for JWT signing',
            format: String,
            default: 'CHANGE_ME',
            env: 'AUTH_JWT_SECRET',
            arg: 'auth-jwt-secret',
            sensitive: true,
        },
    },
    basicAuth: {
        type: {
            doc: 'Type of basic auth to use',
            format: ['key', 'disabled'],
            default: 'key',
            env: 'BASIC_AUTH_TYPE',
            arg: 'basic-auth-type',
        },
        key: {
            doc: 'Key used for basic authorization',
            format: String,
            default: 'CHANGE_ME',
            env: 'BASIC_AUTH_KEY',
            arg: 'basic-auth-key',
            sensitive: true,
        },
    },
    organization: {
        name: {
            doc: 'Organization name - Used as a folder name in the storage of files',
            format: String,
            default: 'local',
            env: 'ORG_NAME',
            arg: 'org-name',
        },
        hostnames: {
            doc: 'Hostnames the organization maps to',
            format: Array,
            default: ['localhost', '127.0.0.1'],
            env: 'ORG_HOSTNAMES',
            arg: 'org-hostnames',
        },
    }
});

const env = conf.get('env');

try {
    conf.loadFile(`${__dirname}/../config/${env}.yaml`);
} catch (error) {
    // Eat the error...
}

conf.validate();

module.exports = conf;
