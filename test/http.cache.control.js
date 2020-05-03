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

tap.beforeEach(async (done, t) => {
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

    done();
});

tap.afterEach(async (done, t) => {
    await t.context.app.close();
    done();
});

tap.test('cache-control - auth post', async (t) => {
    const { address } = t.context;

    const formData = new FormData();
    formData.append('key', 'change_me');

    const response = await fetch(`${address}/auth/login`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
    });

    t.equals(response.headers.get('cache-control'), 'no-store', 'should be "no-store"');
});

tap.test('cache-control - package - non-scoped', async (t) => {
    const { headers, address } = t.context;

    const formData = new FormData();
    formData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    const uploaded = await fetch(`${address}/pkg/fuzz/1.4.8`, {
        method: 'PUT',
        body: formData,
        redirect: 'manual',
        headers: { ...headers, ...formData.getHeaders()},
    });
    t.equals(uploaded.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // GET file from server
    const fetched = await fetch(`${address}/pkg/fuzz/1.4.8/main/index.js`, {
        method: 'GET',
    });
    t.equals(fetched.headers.get('cache-control'), 'public, max-age=31536000, immutable', 'should be "public, max-age=31536000, immutable"');

    // GET package overview from server
    const overview = await fetch(`${address}/pkg/fuzz/1.4.8`, {
        method: 'GET',
    });
    t.equals(overview.headers.get('cache-control'), 'no-cache', 'should be "no-cache"');

    // GET package versions overview from server
    const versions = await fetch(`${address}/pkg/fuzz`, {
        method: 'GET',
    });
    t.equals(versions.headers.get('cache-control'), 'no-cache', 'should be "no-cache"');
});

tap.test('cache-control - package - scoped', async (t) => {
    const { headers, address } = t.context;

    const formData = new FormData();
    formData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    const uploaded = await fetch(`${address}/pkg/@cuz/fuzz/1.4.8`, {
        method: 'PUT',
        body: formData,
        redirect: 'manual',
        headers: { ...headers, ...formData.getHeaders()},
    });
    t.equals(uploaded.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // GET file from server
    const fetched = await fetch(`${address}/pkg/@cuz/fuzz/1.4.8/main/index.js`, {
        method: 'GET',
    });
    t.equals(fetched.headers.get('cache-control'), 'public, max-age=31536000, immutable', 'should be "public, max-age=31536000, immutable"');

    // GET package overview from server
    const overview = await fetch(`${address}/pkg/@cuz/fuzz/1.4.8`, {
        method: 'GET',
    });
    t.equals(overview.headers.get('cache-control'), 'no-cache', 'should be "no-cache"');

    // GET package versions overview from server
    const versions = await fetch(`${address}/pkg/@cuz/fuzz`, {
        method: 'GET',
    });
    t.equals(versions.headers.get('cache-control'), 'no-cache', 'should be "no-cache"');
});

tap.test('cache-control - npm package - non-scoped', async (t) => {
    const { headers, address } = t.context;

    const formData = new FormData();
    formData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    const uploaded = await fetch(`${address}/npm/fuzz/1.4.8`, {
        method: 'PUT',
        body: formData,
        redirect: 'manual',
        headers: { ...headers, ...formData.getHeaders()},
    });
    t.equals(uploaded.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // GET file from server
    const fetched = await fetch(`${address}/npm/fuzz/1.4.8/main/index.js`, {
        method: 'GET',
    });
    t.equals(fetched.headers.get('cache-control'), 'public, max-age=31536000, immutable', 'should be "public, max-age=31536000, immutable"');

    // GET package overview from server
    const overview = await fetch(`${address}/npm/fuzz/1.4.8`, {
        method: 'GET',
    });
    t.equals(overview.headers.get('cache-control'), 'no-cache', 'should be "no-cache"');

    // GET package versions overview from server
    const versions = await fetch(`${address}/npm/fuzz`, {
        method: 'GET',
    });
    t.equals(versions.headers.get('cache-control'), 'no-cache', 'should be "no-cache"');
});

tap.test('cache-control - npm package - scoped', async (t) => {
    const { headers, address } = t.context;

    const formData = new FormData();
    formData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    const uploaded = await fetch(`${address}/npm/@cuz/fuzz/1.4.8`, {
        method: 'PUT',
        body: formData,
        redirect: 'manual',
        headers: { ...headers, ...formData.getHeaders()},
    });
    t.equals(uploaded.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // GET file from server
    const fetched = await fetch(`${address}/npm/@cuz/fuzz/1.4.8/main/index.js`, {
        method: 'GET',
    });
    t.equals(fetched.headers.get('cache-control'), 'public, max-age=31536000, immutable', 'should be "public, max-age=31536000, immutable"');

    // GET package overview from server
    const overview = await fetch(`${address}/npm/@cuz/fuzz/1.4.8`, {
        method: 'GET',
    });
    t.equals(overview.headers.get('cache-control'), 'no-cache', 'should be "no-cache"');

    // GET package versions overview from server
    const versions = await fetch(`${address}/npm/@cuz/fuzz`, {
        method: 'GET',
    });
    t.equals(versions.headers.get('cache-control'), 'no-cache', 'should be "no-cache"');
});

tap.test('cache-control - map - non-scoped', async (t) => {
    const { headers, address } = t.context;

    const formData = new FormData();
    formData.append('map', fs.createReadStream(FIXTURE_MAP));

    // PUT map on server
    const uploaded = await fetch(`${address}/map/buzz/4.2.2`, {
        method: 'PUT',
        body: formData,
        headers: { ...headers, ...formData.getHeaders()},
        redirect: 'manual',
    });
    t.equals(uploaded.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // GET map from server
    const fetched = await fetch(`${address}/map/buzz/4.2.2`, {
        method: 'GET',
    });
    t.equals(fetched.headers.get('cache-control'), 'public, max-age=31536000, immutable', 'should be "public, max-age=31536000, immutable"');

    // GET map versions overview from server
    const versions = await fetch(`${address}/map/buzz`, {
        method: 'GET',
    });
    t.equals(versions.headers.get('cache-control'), 'no-cache', 'should be "no-cache"');
});

tap.test('cache-control - map - scoped', async (t) => {
    const { headers, address } = t.context;

    const formData = new FormData();
    formData.append('map', fs.createReadStream(FIXTURE_MAP));

    // PUT map on server
    const uploaded = await fetch(`${address}/map/@cuz/buzz/4.2.2`, {
        method: 'PUT',
        body: formData,
        headers: { ...headers, ...formData.getHeaders()},
        redirect: 'manual',
    });
    t.equals(uploaded.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // GET map from server
    const fetched = await fetch(`${address}/map/@cuz/buzz/4.2.2`, {
        method: 'GET',
    });
    t.equals(fetched.headers.get('cache-control'), 'public, max-age=31536000, immutable', 'should be "public, max-age=31536000, immutable"');

    // GET map versions overview from server
    const versions = await fetch(`${address}/map/@cuz/buzz`, {
        method: 'GET',
    });
    t.equals(versions.headers.get('cache-control'), 'no-cache', 'should be "no-cache"');
});

tap.test('cache-control - alias package - non-scoped', async (t) => {
    const { headers, address } = t.context;

    const formDataA = new FormData();
    formDataA.append('package', fs.createReadStream(FIXTURE_PKG));

    const formDataB = new FormData();
    formDataB.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    await fetch(`${address}/pkg/fuzz/8.4.1`, {
        method: 'PUT',
        body: formDataA,
        redirect: 'manual',
        headers: { ...headers, ...formDataA.getHeaders()},
    });

    // PUT files on server
    await fetch(`${address}/pkg/fuzz/8.8.1`, {
        method: 'PUT',
        body: formDataB,
        redirect: 'manual',
        headers: { ...headers, ...formDataB.getHeaders()},
    });

    // PUT alias on server
    const aliasFormData = new FormData();
    aliasFormData.append('version', '8.4.1');

    const alias = await fetch(`${address}/pkg/fuzz/v8`, {
        method: 'PUT',
        body: aliasFormData,
        headers: { ...headers, ...aliasFormData.getHeaders()},
        redirect: 'manual',
    });
    t.equals(alias.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // GET alias from server
    const redirect = await fetch(`${address}/pkg/fuzz/v8/main/index.js`, {
        method: 'GET',
        redirect: 'manual',
    });
    t.equals(redirect.headers.get('cache-control'), 'public, max-age=1200', 'should be "public, max-age=1200"');

    // POST alias on server
    const aliasFormDataB = new FormData();
    aliasFormDataB.append('version', '8.8.1');

    const updated = await fetch(`${address}/pkg/fuzz/v8`, {
        method: 'POST',
        body: aliasFormDataB,
        headers: { ...headers, ...aliasFormDataB.getHeaders()},
        redirect: 'manual',
    });
    t.equals(updated.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // DELETE alias on server
    const deleted = await fetch(`${address}/pkg/fuzz/v8`, {
        method: 'DELETE',
        headers,
    });
    t.equals(deleted.headers.get('cache-control'), 'no-store', 'should be "no-cache"');
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
        headers: { ...headers, ...formDataA.getHeaders()},
    });

    // PUT files on server
    await fetch(`${address}/pkg/@cuz/fuzz/8.8.1`, {
        method: 'PUT',
        body: formDataB,
        redirect: 'manual',
        headers: { ...headers, ...formDataB.getHeaders()},
    });

    // PUT alias on server
    const aliasFormData = new FormData();
    aliasFormData.append('version', '8.4.1');

    const alias = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
        method: 'PUT',
        body: aliasFormData,
        headers: { ...headers, ...aliasFormData.getHeaders()},
        redirect: 'manual',
    });
    t.equals(alias.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // GET alias from server
    const redirect = await fetch(`${address}/pkg/@cuz/fuzz/v8/main/index.js`, {
        method: 'GET',
        redirect: 'manual',
    });
    t.equals(redirect.headers.get('cache-control'), 'public, max-age=1200', 'should be "public, max-age=1200"');

    // POST alias on server
    const aliasFormDataB = new FormData();
    aliasFormDataB.append('version', '8.8.1');

    const updated = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
        method: 'POST',
        body: aliasFormDataB,
        headers: { ...headers, ...aliasFormDataB.getHeaders()},
        redirect: 'manual',
    });
    t.equals(updated.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // DELETE alias on server
    const deleted = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
        method: 'DELETE',
        headers,
    });
    t.equals(deleted.headers.get('cache-control'), 'no-store', 'should be "no-cache"');
});

tap.test('cache-control - alias NPM package - non-scoped', async (t) => {
    const { headers, address } = t.context;

    const formDataA = new FormData();
    formDataA.append('package', fs.createReadStream(FIXTURE_PKG));

    const formDataB = new FormData();
    formDataB.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    await fetch(`${address}/npm/fuzz/8.4.1`, {
        method: 'PUT',
        body: formDataA,
        redirect: 'manual',
        headers: { ...headers, ...formDataA.getHeaders()},
    });

    // PUT files on server
    await fetch(`${address}/npm/fuzz/8.8.1`, {
        method: 'PUT',
        body: formDataB,
        redirect: 'manual',
        headers: { ...headers, ...formDataB.getHeaders()},
    });

    // PUT alias on server
    const aliasFormData = new FormData();
    aliasFormData.append('version', '8.4.1');

    const alias = await fetch(`${address}/npm/fuzz/v8`, {
        method: 'PUT',
        body: aliasFormData,
        headers: { ...headers, ...aliasFormData.getHeaders()},
        redirect: 'manual',
    });
    t.equals(alias.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // GET alias from server
    const redirect = await fetch(`${address}/npm/fuzz/v8/main/index.js`, {
        method: 'GET',
        redirect: 'manual',
    });
    t.equals(redirect.headers.get('cache-control'), 'public, max-age=1200', 'should be "public, max-age=1200"');

    // POST alias on server
    const aliasFormDataB = new FormData();
    aliasFormDataB.append('version', '8.8.1');

    const updated = await fetch(`${address}/npm/fuzz/v8`, {
        method: 'POST',
        body: aliasFormDataB,
        headers: { ...headers, ...aliasFormDataB.getHeaders()},
        redirect: 'manual',
    });
    t.equals(updated.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // DELETE alias on server
    const deleted = await fetch(`${address}/npm/fuzz/v8`, {
        method: 'DELETE',
        headers,
    });
    t.equals(deleted.headers.get('cache-control'), 'no-store', 'should be "no-cache"');
});

tap.test('cache-control - alias NPM package - scoped', async (t) => {
    const { headers, address } = t.context;

    const formDataA = new FormData();
    formDataA.append('package', fs.createReadStream(FIXTURE_PKG));

    const formDataB = new FormData();
    formDataB.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    await fetch(`${address}/npm/@cuz/fuzz/8.4.1`, {
        method: 'PUT',
        body: formDataA,
        redirect: 'manual',
        headers: { ...headers, ...formDataA.getHeaders()},
    });

    // PUT files on server
    await fetch(`${address}/npm/@cuz/fuzz/8.8.1`, {
        method: 'PUT',
        body: formDataB,
        redirect: 'manual',
        headers: { ...headers, ...formDataB.getHeaders()},
    });

    // PUT alias on server
    const aliasFormData = new FormData();
    aliasFormData.append('version', '8.4.1');

    const alias = await fetch(`${address}/npm/@cuz/fuzz/v8`, {
        method: 'PUT',
        body: aliasFormData,
        headers: { ...headers, ...aliasFormData.getHeaders()},
        redirect: 'manual',
    });
    t.equals(alias.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // GET alias from server
    const redirect = await fetch(`${address}/npm/@cuz/fuzz/v8/main/index.js`, {
        method: 'GET',
        redirect: 'manual',
    });
    t.equals(redirect.headers.get('cache-control'), 'public, max-age=1200', 'should be "public, max-age=1200"');

    // POST alias on server
    const aliasFormDataB = new FormData();
    aliasFormDataB.append('version', '8.8.1');

    const updated = await fetch(`${address}/npm/@cuz/fuzz/v8`, {
        method: 'POST',
        body: aliasFormDataB,
        headers: { ...headers, ...aliasFormDataB.getHeaders()},
        redirect: 'manual',
    });
    t.equals(updated.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // DELETE alias on server
    const deleted = await fetch(`${address}/npm/@cuz/fuzz/v8`, {
        method: 'DELETE',
        headers,
    });
    t.equals(deleted.headers.get('cache-control'), 'no-store', 'should be "no-cache"');
});

tap.test('cache-control - alias map - non-scoped', async (t) => {
    const { headers, address } = t.context;

    const formDataA = new FormData();
    formDataA.append('map', fs.createReadStream(FIXTURE_MAP));

    const formDataB = new FormData();
    formDataB.append('map', fs.createReadStream(FIXTURE_MAP));

    // PUT maps on server
    await fetch(`${address}/map/buzz/4.2.2`, {
        method: 'PUT',
        body: formDataA,
        headers: { ...headers, ...formDataA.getHeaders()},
        redirect: 'manual',
    });

    await fetch(`${address}/map/buzz/4.4.2`, {
        method: 'PUT',
        body: formDataB,
        headers: { ...headers, ...formDataB.getHeaders()},
        redirect: 'manual',
    });

    // PUT alias on server
    const aliasFormData = new FormData();
    aliasFormData.append('version', '4.2.2');

    const alias = await fetch(`${address}/map/buzz/v4`, {
        method: 'PUT',
        body: aliasFormData,
        headers: { ...headers, ...aliasFormData.getHeaders()},
        redirect: 'manual',
    });
    t.equals(alias.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // GET alias from server
    const redirect = await fetch(`${address}/map/buzz/v4`, {
        method: 'GET',
        redirect: 'manual',
    });
    t.equals(redirect.headers.get('cache-control'), 'public, max-age=1200', 'should be "public, max-age=1200"');

    // POST alias on server
    const aliasFormDataB = new FormData();
    aliasFormDataB.append('version', '4.4.2');

    const updated = await fetch(`${address}/map/buzz/v4`, {
        method: 'POST',
        body: aliasFormDataB,
        headers: { ...headers, ...aliasFormDataB.getHeaders()},
        redirect: 'manual',
    });
    t.equals(updated.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // DELETE alias on server
    const deleted = await fetch(`${address}/map/buzz/v4`, {
        method: 'DELETE',
        headers,
    });
    t.equals(deleted.headers.get('cache-control'), 'no-store', 'should be "no-cache"');
});

tap.test('cache-control - alias map - scoped', async (t) => {
    const { headers, address } = t.context;

    const formDataA = new FormData();
    formDataA.append('map', fs.createReadStream(FIXTURE_MAP));

    const formDataB = new FormData();
    formDataB.append('map', fs.createReadStream(FIXTURE_MAP));

    // PUT maps on server
    await fetch(`${address}/map/@cuz/buzz/4.2.2`, {
        method: 'PUT',
        body: formDataA,
        headers: { ...headers, ...formDataA.getHeaders()},
        redirect: 'manual',
    });

    await fetch(`${address}/map/@cuz/buzz/4.4.2`, {
        method: 'PUT',
        body: formDataB,
        headers: { ...headers, ...formDataB.getHeaders()},
        redirect: 'manual',
    });

    // PUT alias on server
    const aliasFormData = new FormData();
    aliasFormData.append('version', '4.2.2');

    const alias = await fetch(`${address}/map/@cuz/buzz/v4`, {
        method: 'PUT',
        body: aliasFormData,
        headers: { ...headers, ...aliasFormData.getHeaders()},
        redirect: 'manual',
    });
    t.equals(alias.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // GET alias from server
    const redirect = await fetch(`${address}/map/@cuz/buzz/v4`, {
        method: 'GET',
        redirect: 'manual',
    });
    t.equals(redirect.headers.get('cache-control'), 'public, max-age=1200', 'should be "public, max-age=1200"');

    // POST alias on server
    const aliasFormDataB = new FormData();
    aliasFormDataB.append('version', '4.4.2');

    const updated = await fetch(`${address}/map/@cuz/buzz/v4`, {
        method: 'POST',
        body: aliasFormDataB,
        headers: { ...headers, ...aliasFormDataB.getHeaders()},
        redirect: 'manual',
    });
    t.equals(updated.headers.get('cache-control'), 'no-store', 'should be "no-store"');

    // DELETE alias on server
    const deleted = await fetch(`${address}/map/@cuz/buzz/v4`, {
        method: 'DELETE',
        headers,
    });
    t.equals(deleted.headers.get('cache-control'), 'no-store', 'should be "no-cache"');
});
