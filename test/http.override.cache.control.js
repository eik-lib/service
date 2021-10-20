'use strict';

const FormData = require('form-data');
const fastify = require('fastify');
const fetch = require('node-fetch');
const path = require('path');
const tap = require('tap');
const fs = require('fs');

const Server = require('..');
const Sink = require('../node_modules/@eik/core/lib/sinks/test');

const FIXTURE_PKG = path.resolve(__dirname, '../fixtures/archive.tgz');
const FIXTURE_MAP = path.resolve(__dirname, '../fixtures/import-map.json');

// Ignore the timestamp for "created" field in the snapshots
tap.cleanSnapshot = (s) => {
    const regex = /"created": [0-9]+,/gi;
    return s.replace(regex, '"created": -1,');
};

tap.beforeEach(async (t) => {
    const sink = new Sink();
    const service = new Server({
        customSink: sink,
        aliasCacheControl: 'public, max-age=600',
    });

    const app = fastify({
        ignoreTrailingSlash: true,
    });
    app.register(service.api());

    const address = await app.listen(0, 'localhost');

    const formData = new FormData();
    formData.append('key', 'change_me');

    const res = await fetch(`${address}/auth/login`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
    });

    const { token } = await res.json();
    const headers = { Authorization: `Bearer ${token}` };

    t.context = {
        // eslint-disable-line no-param-reassign
        address,
        headers,
        app,
    };
});

tap.afterEach(async (t) => {
    await t.context.app.close();
});

tap.test('cache-control - alias package - scoped', async (t) => {
    const { headers, address } = t.context;

    const formDataA = new FormData();
    formDataA.append('package', fs.createReadStream(FIXTURE_PKG));

    const formDataB = new FormData();
    formDataB.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    await fetch(`${address}/pkg/@cuz/fuzz/8.4.1`, {
        method: 'PUT',
        body: formDataA,
        redirect: 'manual',
        headers: { ...headers, ...formDataA.getHeaders() },
    });

    // PUT files on server
    await fetch(`${address}/pkg/@cuz/fuzz/8.8.1`, {
        method: 'PUT',
        body: formDataB,
        redirect: 'manual',
        headers: { ...headers, ...formDataB.getHeaders() },
    });

    // PUT alias on server
    const aliasFormData = new FormData();
    aliasFormData.append('version', '8.4.1');

    const alias = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
        method: 'PUT',
        body: aliasFormData,
        headers: { ...headers, ...aliasFormData.getHeaders() },
        redirect: 'manual',
    });
    t.equal(
        alias.headers.get('cache-control'),
        'no-store',
        'should be "no-store"',
    );

    // GET alias from server
    const redirect = await fetch(`${address}/pkg/@cuz/fuzz/v8/main/index.js`, {
        method: 'GET',
        redirect: 'manual',
    });

    t.equal(
        redirect.headers.get('cache-control'),
        'public, max-age=600',
        'should be "public, max-age=600"',
    );

    // DELETE alias on server
    const deleted = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
        method: 'DELETE',
        headers,
    });
    t.equal(
        deleted.headers.get('cache-control'),
        'no-store',
        'should be "no-cache"',
    );
});