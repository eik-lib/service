'use strict';

const FormData = require('form-data');
const fastify = require('fastify');
const fetch = require('node-fetch');
const path = require('path');
const tap = require('tap');
const fs = require('fs');

const Server = require("..");
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
    const service = new Server({ customSink: sink });

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
    const headers = { 'Authorization': `Bearer ${token}` };

    t.context = { // eslint-disable-line no-param-reassign
        address,
        headers,
        app,
    };
});

tap.afterEach(async (t) => {
    await t.context.app.close();
});

tap.test('query params - package', async (t) => {
    const { headers, address } = t.context;

    const formData = new FormData();
    formData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    await fetch(`${address}/pkg/fuzz/8.4.1`, {
        method: 'PUT',
        body: formData,
        headers: { ...headers, ...formData.getHeaders()},
        redirect: 'manual',
    });

    // GET file from server
    const downloaded = await fetch(`${address}/pkg/fuzz/8.4.1/main/index.js?foo=bar`, {
        method: 'GET',
    });

    t.equal(downloaded.status, 200, 'on GET of file, server should respond with 200 ok');
});

tap.test('query params - NPM package', async (t) => {
    const { headers, address } = t.context;

    const formData = new FormData();
    formData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    await fetch(`${address}/npm/fuzz/8.4.1`, {
        method: 'PUT',
        body: formData,
        headers: { ...headers, ...formData.getHeaders()},
        redirect: 'manual',
    });

    // GET file from server
    const downloaded = await fetch(`${address}/npm/fuzz/8.4.1/main/index.js?foo=bar`, {
        method: 'GET',
    });

    t.equal(downloaded.status, 200, 'on GET of file, server should respond with 200 ok');
});

tap.test('query params - map', async (t) => {
    const { headers, address } = t.context;

    const formData = new FormData();
    formData.append('map', fs.createReadStream(FIXTURE_MAP));

    // PUT map on server
    await fetch(`${address}/map/buzz/4.2.2`, {
        method: 'PUT',
        body: formData,
        headers: { ...headers, ...formData.getHeaders()},
        redirect: 'manual',
    });

    // GET file from server
    const downloaded = await fetch(`${address}/map/buzz/4.2.2?foo=bar`, {
        method: 'GET',
    });

    t.equal(downloaded.status, 200, 'on GET of file, server should respond with 200 ok');
});
