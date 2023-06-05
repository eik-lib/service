import FormData from 'form-data';
import Fastify from 'fastify';
import fetch from 'node-fetch';
import path from 'path';
import tap from 'tap';
import url from 'url';
import fs from 'fs';

import Sink from "@eik/core/lib/sinks/test.js";
import Server from '../lib/main.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const FIXTURE_PKG = path.resolve(__dirname, '../fixtures/archive.tgz');

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

    const { token } = await res.json();
    const headers = { Authorization: `Bearer ${token}` };

    // eslint-disable-next-line no-param-reassign
    t.context = {
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
