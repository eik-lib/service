import FormData from 'form-data';
import fastify from 'fastify';
import fetch from 'node-fetch';
import path from 'path';
import tap from 'tap';
import url from 'url';
import fs from 'fs';

import Sink from './utils/sink.js';
import Server from '../lib/main.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const FIXTURE_PKG = path.resolve(__dirname, '..', 'fixtures', 'archive.tgz');

// Ignore the timestamp for "created" field in the snapshots
tap.cleanSnapshot = (s) => {
    const regex = /"created": [0-9]+,/gi;
    return s.replace(regex, '"created": -1,');
};

/** @type {import('fastify').FastifyInstance} */
let app;
/** @type {string} */
let address;
/** @type {Record<string, string>} */
let headers;
/** @type {Sink} */
let sink;

tap.before(async () => {
    sink = new Sink();
    const service = new Server({
        sink,
        aliasCacheControl: 'public, max-age=600',
    });

    app = fastify({
        ignoreTrailingSlash: true,
        forceCloseConnections: true,
    });
    app.register(service.api());

    address = await app.listen({ port: 0, host: '127.0.0.1' });

    const formData = new FormData();
    formData.append('key', 'change_me');
    const res = await fetch(`${address}/auth/login`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
    });
    const login = /** @type {{ token: string }} */ (await res.json());
    headers = { Authorization: `Bearer ${login.token}` };
});

tap.afterEach(() => {
    sink.clear();
});

tap.teardown(async () => {
    await app.close();
});

tap.test('cache-control - alias package - scoped', async (t) => {
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
