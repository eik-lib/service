'use strict';

// const { test, beforeEach, afterEach } = require('tap');
const FormData = require('form-data');
const fetch = require('node-fetch');
const path = require('path');
const tap = require('tap');
const fs = require('fs');

const Server = require('../../services/fastify');
const Sink = require('../../lib/sinks/test');

const FIXTURE_PKG = path.resolve(__dirname, '../../fixtures/archive.tgz');

// Ignore the timestamp for "created" field in the snapshots
tap.cleanSnapshot = (s) => {
    const regex = /"created": [0-9]+,/gi;
    return s.replace(regex, '"created": -1,');
};

tap.beforeEach(async (done, t) => {
    const sink = new Sink();
    const service = new Server({ customSink: sink, port: 0, logger: false });
    const address = await service.start();

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
        service,
        address,
        headers,
    };

    done();
});

tap.afterEach(async (done, t) => {
    await t.context.service.stop();
    done();
});

tap.test('alias package - no auth token on PUT - scoped', async (t) => {
    const { address } = t.context;

    // PUT alias on server
    const aliasFormData = new FormData();
    aliasFormData.append('version', '8.4.1');

    const alias = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
        method: 'PUT',
        body: aliasFormData,
        headers: aliasFormData.getHeaders(),
    });

    t.equals(alias.status, 401, 'on PUT of alias, server should respond with a 401 Unauthorized');
});

tap.test('alias package - no auth token on PUT - non scoped', async (t) => {
    const { address } = t.context;

    // PUT alias on server
    const aliasFormData = new FormData();
    aliasFormData.append('version', '8.4.1');

    const alias = await fetch(`${address}/pkg/fuzz/v8`, {
        method: 'PUT',
        body: aliasFormData,
        headers: aliasFormData.getHeaders(),
    });

    t.equals(alias.status, 401, 'on PUT of alias, server should respond with a 401 Unauthorized');
});

tap.test('alias package - no auth token on POST - scoped', async (t) => {
    const { address } = t.context;

    // POST alias on server
    const aliasFormData = new FormData();
    aliasFormData.append('version', '8.4.1');

    const alias = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
        method: 'POST',
        body: aliasFormData,
        headers: aliasFormData.getHeaders(),
    });

    t.equals(alias.status, 401, 'on POST of alias, server should respond with a 401 Unauthorized');
});

tap.test('alias package - no auth token on POST - non scoped', async (t) => {
    const { address } = t.context;

    // POST alias on server
    const aliasFormData = new FormData();
    aliasFormData.append('version', '8.4.1');

    const alias = await fetch(`${address}/pkg/fuzz/v8`, {
        method: 'POST',
        body: aliasFormData,
        headers: aliasFormData.getHeaders(),
    });

    t.equals(alias.status, 401, 'on POST of alias, server should respond with a 401 Unauthorized');
});

tap.test('alias package - no auth token on DELETE - scoped', async (t) => {
    const { address } = t.context;

    // DELETE alias on server
    const alias = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
        method: 'DELETE',
    });

    t.equals(alias.status, 401, 'on DELETE of alias, server should respond with a 401 Unauthorized');
});

tap.test('alias package - no auth token on DELETE - non scoped', async (t) => {
    const { address } = t.context;

    // DELETE alias on server
    const alias = await fetch(`${address}/pkg/fuzz/v8`, {
        method: 'DELETE',
    });

    t.equals(alias.status, 401, 'on DELETE of alias, server should respond with a 401 Unauthorized');
});

tap.test('alias package - put alias, then get file overview through alias - scoped', async (t) => {
    const { headers, address } = t.context;

    const pkgFormData = new FormData();
    pkgFormData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    const uploaded = await fetch(`${address}/pkg/@cuz/fuzz/8.4.1`, {
        method: 'PUT',
        body: pkgFormData,
        headers: { ...headers, ...pkgFormData.getHeaders()},
        redirect: 'manual',
    });

    t.equals(uploaded.status, 303, 'on PUT of package, server should respond with a 303 redirect');
    t.equals(uploaded.headers.get('location'), `${address}/pkg/@cuz/fuzz/8.4.1`, 'on PUT of package, server should respond with a location header');

    // PUT alias on server
    const aliasFormData = new FormData();
    aliasFormData.append('version', '8.4.1');

    const alias = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
        method: 'PUT',
        body: aliasFormData,
        headers: { ...headers, ...aliasFormData.getHeaders()},
        redirect: 'manual',
    });

    t.equals(alias.status, 303, 'on PUT of alias, server should respond with a 303 redirect');
    t.equals(alias.headers.get('location'), `${address}/pkg/@cuz/fuzz/v8`, 'on PUT of alias, server should respond with a location header');

    // GET file through alias from server
    const redirect = await fetch(alias.headers.get('location'), {
        method: 'GET',
        redirect: 'manual',
    });

    t.equals(redirect.status, 303, 'on GET of file through alias, server should respond with a 303 redirect');
    t.equals(redirect.headers.get('location'), `${address}/pkg/@cuz/fuzz/8.4.1`, 'on GET of file through alias, server should respond with a location header');

    // GET file from server
    const downloaded = await fetch(redirect.headers.get('location'), {
        method: 'GET',
    });

    const downloadedResponse = await downloaded.json();

    t.equals(downloaded.status, 200, 'on GET of file, server should respond with 200 ok');
    t.matchSnapshot(downloadedResponse, 'on GET of file, response should match snapshot');
});

tap.test('alias package - put alias, then get file overview through alias - non scoped', async (t) => {
    const { headers, address } = t.context;

    const pkgFormData = new FormData();
    pkgFormData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    const uploaded = await fetch(`${address}/pkg/fuzz/8.4.1`, {
        method: 'PUT',
        body: pkgFormData,
        headers: { ...headers, ...pkgFormData.getHeaders()},
        redirect: 'manual',
    });

    t.equals(uploaded.status, 303, 'on PUT of package, server should respond with a 303 redirect');
    t.equals(uploaded.headers.get('location'), `${address}/pkg/fuzz/8.4.1`, 'on PUT of package, server should respond with a location header');

    // PUT alias on server
    const aliasFormData = new FormData();
    aliasFormData.append('version', '8.4.1');

    const alias = await fetch(`${address}/pkg/fuzz/v8`, {
        method: 'PUT',
        body: aliasFormData,
        headers: { ...headers, ...aliasFormData.getHeaders()},
        redirect: 'manual',
    });

    t.equals(alias.status, 303, 'on PUT of alias, server should respond with a 303 redirect');
    t.equals(alias.headers.get('location'), `${address}/pkg/fuzz/v8`, 'on PUT of alias, server should respond with a location header');

    // GET file through alias from server
    const redirect = await fetch(alias.headers.get('location'), {
        method: 'GET',
        redirect: 'manual',
    });

    t.equals(redirect.status, 303, 'on GET of file through alias, server should respond with a 303 redirect');
    t.equals(redirect.headers.get('location'), `${address}/pkg/fuzz/8.4.1`, 'on GET of file through alias, server should respond with a location header');

    // GET file from server
    const downloaded = await fetch(redirect.headers.get('location'), {
        method: 'GET',
    });

    const downloadedResponse = await downloaded.json();

    t.equals(downloaded.status, 200, 'on GET of file, server should respond with 200 ok');
    t.matchSnapshot(downloadedResponse, 'on GET of file, response should match snapshot');
});

tap.test('alias package - put alias, then get file through alias - scoped', async (t) => {
    const { headers, address } = t.context;

    const pkgFormData = new FormData();
    pkgFormData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    const uploaded = await fetch(`${address}/pkg/@cuz/fuzz/8.4.1`, {
        method: 'PUT',
        body: pkgFormData,
        headers: { ...headers, ...pkgFormData.getHeaders()},
        redirect: 'manual',
    });

    t.equals(uploaded.status, 303, 'on PUT of package, server should respond with a 303 redirect');
    t.equals(uploaded.headers.get('location'), `${address}/pkg/@cuz/fuzz/8.4.1`, 'on PUT of package, server should respond with a location header');

    // PUT alias on server
    const aliasFormData = new FormData();
    aliasFormData.append('version', '8.4.1');

    const alias = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
        method: 'PUT',
        body: aliasFormData,
        headers: { ...headers, ...aliasFormData.getHeaders()},
        redirect: 'manual',
    });

    t.equals(alias.status, 303, 'on PUT of alias, server should respond with a 303 redirect');
    t.equals(alias.headers.get('location'), `${address}/pkg/@cuz/fuzz/v8`, 'on PUT of alias, server should respond with a location header');

    // GET file through alias from server
    const redirect = await fetch(`${address}/pkg/@cuz/fuzz/v8/main/index.js`, {
        method: 'GET',
        redirect: 'manual',
    });

    t.equals(redirect.status, 303, 'on GET of file through alias, server should respond with a 303 redirect');
    t.equals(redirect.headers.get('location'), `${address}/pkg/@cuz/fuzz/8.4.1/main/index.js`, 'on GET of file through alias, server should respond with a location header');

    // GET file from server
    const downloaded = await fetch(redirect.headers.get('location'), {
        method: 'GET',
    });

    const downloadedResponse = await downloaded.text();

    t.equals(downloaded.status, 200, 'on GET of file, server should respond with 200 ok');
    t.matchSnapshot(downloadedResponse, 'on GET of file, response should match snapshot');
});

tap.test('alias package - put alias, then get file through alias - non scoped', async (t) => {
    const { headers, address } = t.context;

    const pkgFormData = new FormData();
    pkgFormData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    const uploaded = await fetch(`${address}/pkg/fuzz/8.4.1`, {
        method: 'PUT',
        body: pkgFormData,
        headers: { ...headers, ...pkgFormData.getHeaders()},
        redirect: 'manual',
    });

    t.equals(uploaded.status, 303, 'on PUT of package, server should respond with a 303 redirect');
    t.equals(uploaded.headers.get('location'), `${address}/pkg/fuzz/8.4.1`, 'on PUT of package, server should respond with a location header');

    // PUT alias on server
    const aliasFormData = new FormData();
    aliasFormData.append('version', '8.4.1');

    const alias = await fetch(`${address}/pkg/fuzz/v8`, {
        method: 'PUT',
        body: aliasFormData,
        headers: { ...headers, ...aliasFormData.getHeaders()},
        redirect: 'manual',
    });

    t.equals(alias.status, 303, 'on PUT of alias, server should respond with a 303 redirect');
    t.equals(alias.headers.get('location'), `${address}/pkg/fuzz/v8`, 'on PUT of alias, server should respond with a location header');

    // GET file through alias from server
    const redirect = await fetch(`${address}/pkg/fuzz/v8/main/index.js`, {
        method: 'GET',
        redirect: 'manual',
    });

    t.equals(redirect.status, 303, 'on GET of file through alias, server should respond with a 303 redirect');
    t.equals(redirect.headers.get('location'), `${address}/pkg/fuzz/8.4.1/main/index.js`, 'on GET of file through alias, server should respond with a location header');

    // GET file from server
    const downloaded = await fetch(redirect.headers.get('location'), {
        method: 'GET',
    });

    const downloadedResponse = await downloaded.text();

    t.equals(downloaded.status, 200, 'on GET of file, server should respond with 200 ok');
    t.matchSnapshot(downloadedResponse, 'on GET of file, response should match snapshot');
});

tap.test('alias package - put alias, then update alias, then get file through alias - scoped', async (t) => {
    const { headers, address } = t.context;

    // PUT packages on server
    const pkgFormDataA = new FormData();
    pkgFormDataA.append('package', fs.createReadStream(FIXTURE_PKG));
    await fetch(`${address}/pkg/@cuz/fuzz/8.4.1`, {
        method: 'PUT',
        body: pkgFormDataA,
        headers: { ...headers, ...pkgFormDataA.getHeaders()},
        redirect: 'manual',
    });

    const pkgFormDataB = new FormData();
    pkgFormDataB.append('package', fs.createReadStream(FIXTURE_PKG));
    await fetch(`${address}/pkg/@cuz/fuzz/8.8.9`, {
        method: 'PUT',
        body: pkgFormDataB,
        headers: { ...headers, ...pkgFormDataB.getHeaders()},
        redirect: 'manual',
    });

    // PUT alias on server
    const aliasFormDataA = new FormData();
    aliasFormDataA.append('version', '8.4.1');

    const aliasA = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
        method: 'PUT',
        body: aliasFormDataA,
        headers: { ...headers, ...aliasFormDataA.getHeaders()},
    });

    const aliasResponseA = await aliasA.json();

    t.equals(aliasResponseA.version, '8.4.1', 'on PUT of alias, alias should redirect to set "version"');
    t.equals(aliasResponseA.name, '@cuz/fuzz', 'on PUT of alias, alias should redirect to set "name"');

    // POST alias on server
    const aliasFormDataB = new FormData();
    aliasFormDataB.append('version', '8.8.9');

    const aliasB = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
        method: 'POST',
        body: aliasFormDataB,
        headers: { ...headers, ...aliasFormDataB.getHeaders()},
    });

    const aliasResponseB = await aliasB.json();

    t.equals(aliasResponseB.version, '8.8.9', 'on POST of alias, alias should redirect to updated "version"');
    t.equals(aliasResponseB.name, '@cuz/fuzz', 'on POST of alias, alias should redirect to set "name"');
});

tap.test('alias package - put alias, then update alias, then get file through alias - non scoped', async (t) => {
    const { headers, address } = t.context;

    // PUT packages on server
    const pkgFormDataA = new FormData();
    pkgFormDataA.append('package', fs.createReadStream(FIXTURE_PKG));
    await fetch(`${address}/pkg/fuzz/8.4.1`, {
        method: 'PUT',
        body: pkgFormDataA,
        headers: { ...headers, ...pkgFormDataA.getHeaders()},
        redirect: 'manual',
    });

    const pkgFormDataB = new FormData();
    pkgFormDataB.append('package', fs.createReadStream(FIXTURE_PKG));
    await fetch(`${address}/pkg/fuzz/8.8.9`, {
        method: 'PUT',
        body: pkgFormDataB,
        headers: { ...headers, ...pkgFormDataB.getHeaders()},
        redirect: 'manual',
    });

    // PUT alias on server
    const aliasFormDataA = new FormData();
    aliasFormDataA.append('version', '8.4.1');

    const aliasA = await fetch(`${address}/pkg/fuzz/v8`, {
        method: 'PUT',
        body: aliasFormDataA,
        headers: { ...headers, ...aliasFormDataA.getHeaders()},
    });

    const aliasResponseA = await aliasA.json();

    t.equals(aliasResponseA.version, '8.4.1', 'on PUT of alias, alias should redirect to set "version"');
    t.equals(aliasResponseA.name, 'fuzz', 'on PUT of alias, alias should redirect to set "name"');

    // POST alias on server
    const aliasFormDataB = new FormData();
    aliasFormDataB.append('version', '8.8.9');

    const aliasB = await fetch(`${address}/pkg/fuzz/v8`, {
        method: 'POST',
        body: aliasFormDataB,
        headers: { ...headers, ...aliasFormDataB.getHeaders()},
    });

    const aliasResponseB = await aliasB.json();

    t.equals(aliasResponseB.version, '8.8.9', 'on POST of alias, alias should redirect to updated "version"');
    t.equals(aliasResponseB.name, 'fuzz', 'on POST of alias, alias should redirect to set "name"');
});

tap.test('alias package - put alias, then delete alias, then get file through alias - scoped', async (t) => {
    const { headers, address } = t.context;

    const pkgFormData = new FormData();
    pkgFormData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    const uploaded = await fetch(`${address}/pkg/@cuz/fuzz/8.4.1`, {
        method: 'PUT',
        body: pkgFormData,
        headers: { ...headers, ...pkgFormData.getHeaders()},
        redirect: 'manual',
    });

    t.equals(uploaded.status, 303, 'on PUT of package, server should respond with a 303 redirect');
    t.equals(uploaded.headers.get('location'), `${address}/pkg/@cuz/fuzz/8.4.1`, 'on PUT of package, server should respond with a location header');

    // PUT alias on server
    const aliasFormData = new FormData();
    aliasFormData.append('version', '8.4.1');

    const alias = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
        method: 'PUT',
        body: aliasFormData,
        headers: { ...headers, ...aliasFormData.getHeaders()},
    });

    const aliasResponse = await alias.json();

    t.equals(aliasResponse.version, '8.4.1', 'on PUT of alias, alias should redirect to set "version"');
    t.equals(aliasResponse.name, '@cuz/fuzz', 'on PUT of alias, alias should redirect to set "name"');

    // DELETE alias on server
    const deleted = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
        method: 'DELETE',
        headers,
    });

    t.equals(deleted.status, 204, 'on DELETE of alias, server should respond with a 204 Deleted');

    // GET file through alias from server
    const errored = await fetch(`${address}/pkg/@cuz/fuzz/v8/main/index.js`, {
        method: 'GET',
        redirect: 'manual',
    });

    t.equals(errored.status, 404, 'on GET of file through deleted alias, server should respond with a 404 Not Found');
});

tap.test('alias package - put alias, then delete alias, then get file through alias - non scoped', async (t) => {
    const { headers, address } = t.context;

    const pkgFormData = new FormData();
    pkgFormData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    const uploaded = await fetch(`${address}/pkg/fuzz/8.4.1`, {
        method: 'PUT',
        body: pkgFormData,
        headers: { ...headers, ...pkgFormData.getHeaders()},
        redirect: 'manual',
    });

    t.equals(uploaded.status, 303, 'on PUT of package, server should respond with a 303 redirect');
    t.equals(uploaded.headers.get('location'), `${address}/pkg/fuzz/8.4.1`, 'on PUT of package, server should respond with a location header');

    // PUT alias on server
    const aliasFormData = new FormData();
    aliasFormData.append('version', '8.4.1');

    const alias = await fetch(`${address}/pkg/fuzz/v8`, {
        method: 'PUT',
        body: aliasFormData,
        headers: { ...headers, ...aliasFormData.getHeaders()},
    });

    const aliasResponse = await alias.json();

    t.equals(aliasResponse.version, '8.4.1', 'on PUT of alias, alias should redirect to set "version"');
    t.equals(aliasResponse.name, 'fuzz', 'on PUT of alias, alias should redirect to set "name"');

    // DELETE alias on server
    const deleted = await fetch(`${address}/pkg/fuzz/v8`, {
        method: 'DELETE',
        headers,
    });

    t.equals(deleted.status, 204, 'on DELETE of alias, server should respond with a 204 Deleted');

    // GET file through alias from server
    const errored = await fetch(`${address}/pkg/fuzz/v8/main/index.js`, {
        method: 'GET',
        redirect: 'manual',
    });

    t.equals(errored.status, 404, 'on GET of file through deleted alias, server should respond with a 404 Not Found');
});
