import FormData from 'form-data';
import Fastify from 'fastify';
import fetch from 'node-fetch';
import path from 'path';
import tap from 'tap';
import url from 'url';
import fs from 'fs';

import Sink from '@eik/core/lib/sinks/test.js';
import Server from '../lib/main.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const FIXTURE_PKG = path.resolve(__dirname, '../fixtures/archive.tgz');
const FIXTURE_MAP = path.resolve(__dirname, '../fixtures/import-map.json');

// Ignore the timestamp for "created" field in the snapshots
tap.cleanSnapshot = (s) => {
    const regex = /"created": [0-9]+,/gi;
    return s.replace(regex, '"created": -1,');
};

tap.beforeEach(async (t) => {
    const sink = new Sink();
    const service = new Server({ sink });

    const app = Fastify({
        ignoreTrailingSlash: true,
    });
    app.register(service.api());

    const address = await app.listen({ port: 0, host: '127.0.0.1' });

    const formData = new FormData();
    formData.append('key', 'change_me');

    const res = await fetch(`${address}/auth/login`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
    });

    const { token } = /** @type {{ token: string }} */ (await res.json());
    const headers = { Authorization: `Bearer ${token}` };

    t.context = {
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
        headers: { ...headers, ...formData.getHeaders() },
        redirect: 'manual',
    });

    // GET file from server
    const downloaded = await fetch(
        `${address}/pkg/fuzz/8.4.1/main/index.js?foo=bar`,
        {
            method: 'GET',
        },
    );

    t.equal(
        downloaded.status,
        200,
        'on GET of file, server should respond with 200 ok',
    );
});

tap.test('query params - NPM package', async (t) => {
    const { headers, address } = t.context;

    const formData = new FormData();
    formData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    await fetch(`${address}/npm/fuzz/8.4.1`, {
        method: 'PUT',
        body: formData,
        headers: { ...headers, ...formData.getHeaders() },
        redirect: 'manual',
    });

    // GET file from server
    const downloaded = await fetch(
        `${address}/npm/fuzz/8.4.1/main/index.js?foo=bar`,
        {
            method: 'GET',
        },
    );

    t.equal(
        downloaded.status,
        200,
        'on GET of file, server should respond with 200 ok',
    );
});

tap.test('query params - map', async (t) => {
    const { headers, address } = t.context;

    const formData = new FormData();
    formData.append('map', fs.createReadStream(FIXTURE_MAP));

    // PUT map on server
    await fetch(`${address}/map/buzz/4.2.2`, {
        method: 'PUT',
        body: formData,
        headers: { ...headers, ...formData.getHeaders() },
        redirect: 'manual',
    });

    // GET file from server
    const downloaded = await fetch(`${address}/map/buzz/4.2.2?foo=bar`, {
        method: 'GET',
    });

    t.equal(
        downloaded.status,
        200,
        'on GET of file, server should respond with 200 ok',
    );
});
