import FormData from 'form-data';
import Fastify from 'fastify';
import fetch from 'node-fetch';
import path from 'path';
import tap from 'tap';
import url from 'url';
import fs from 'fs';

import Server from '../lib/main.js';
import Sink from '../node_modules/@eik/core/lib/sinks/test.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const FIXTURE_MAP = path.resolve(__dirname, '../fixtures/import-map.json');

tap.beforeEach(async (t) => {
    const sink = new Sink();
    const service = new Server({ customSink: sink });

    const app = Fastify({
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

tap.test('import-map - no auth token on PUT - scoped', async (t) => {
    const { address } = t.context;

    const formData = new FormData();
    formData.append('map', fs.createReadStream(FIXTURE_MAP));

    // PUT map on server
    const uploaded = await fetch(`${address}/map/@cuz/buzz/4.2.2`, {
        method: 'PUT',
        body: formData,
        headers: formData.getHeaders(),
        redirect: 'manual',
    });

    t.equal(uploaded.status, 401, 'on PUT of map, server should respond with a 401 Unauthorized');
});

tap.test('import-map - no auth token on PUT - non scoped', async (t) => {
    const { address } = t.context;

    const formData = new FormData();
    formData.append('map', fs.createReadStream(FIXTURE_MAP));

    // PUT map on server
    const uploaded = await fetch(`${address}/map/buzz/4.2.2`, {
        method: 'PUT',
        body: formData,
        headers: formData.getHeaders(),
        redirect: 'manual',
    });

    t.equal(uploaded.status, 401, 'on PUT of map, server should respond with a 401 Unauthorized');
});

tap.test('import-map - put map -> get map - scoped successfully uploaded', async (t) => {
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

    t.equal(uploaded.status, 303, 'on PUT of map, server should respond with a 303 redirect');
    t.equal(uploaded.headers.get('location'), `/map/@cuz/buzz/4.2.2`, 'on PUT of map, server should respond with a location header');

    // GET map from server
    const downloaded = await fetch(`${address}/map/@cuz/buzz/4.2.2`, {
        method: 'GET',
    });

    const downloadedResponse = await downloaded.json();

    t.equal(downloaded.status, 200, 'on GET of map, server should respond with 200 ok');
    t.matchSnapshot(downloadedResponse, 'on GET of map, response should match snapshot');
});

tap.test('import-map - put map -> get map - non scoped successfully uploaded', async (t) => {
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

    t.equal(uploaded.status, 303, 'on PUT of map, server should respond with a 303 redirect');
    t.equal(uploaded.headers.get('location'), `/map/buzz/4.2.2`, 'on PUT of map, server should respond with a location header');

    // GET map from server
    const downloaded = await fetch(`${address}/map/buzz/4.2.2`, {
        method: 'GET',
    });

    const downloadedResponse = await downloaded.json();

    t.equal(downloaded.status, 200, 'on GET of map, server should respond with 200 ok');
    t.matchSnapshot(downloadedResponse, 'on GET of map, response should match snapshot');
});

tap.test('import-map - get map versions - scoped', async (t) => {
    const { headers, address } = t.context;

    // PUT map on server

    const formDataA = new FormData();
    formDataA.append('map', fs.createReadStream(FIXTURE_MAP));
    await fetch(`${address}/map/@cuz/buzz/4.2.2`, {
        method: 'PUT',
        body: formDataA,
        headers: { ...headers, ...formDataA.getHeaders()},
        redirect: 'manual',
    });

    const formDataB = new FormData();
    formDataB.append('map', fs.createReadStream(FIXTURE_MAP));
    await fetch(`${address}/map/@cuz/buzz/5.2.2`, {
        method: 'PUT',
        body: formDataB,
        headers: { ...headers, ...formDataB.getHeaders()},
        redirect: 'manual',
    });

    const formDataC = new FormData();
    formDataC.append('map', fs.createReadStream(FIXTURE_MAP));
    await fetch(`${address}/map/@cuz/buzz/4.9.2`, {
        method: 'PUT',
        body: formDataC,
        headers: { ...headers, ...formDataC.getHeaders()},
        redirect: 'manual',
    });

    // GET map from server
    const downloaded = await fetch(`${address}/map/@cuz/buzz`, {
        method: 'GET',
    });

    const downloadedResponse = await downloaded.json();

    t.equal(downloaded.status, 200, 'on GET of map versions, server should respond with 200 ok');
    t.matchSnapshot(downloadedResponse, 'on GET of map versions, response should match snapshot');
});

tap.test('import-map - get map versions - non scoped', async (t) => {
    const { headers, address } = t.context;

    // PUT map on server

    const formDataA = new FormData();
    formDataA.append('map', fs.createReadStream(FIXTURE_MAP));
    await fetch(`${address}/map/buzz/4.2.2`, {
        method: 'PUT',
        body: formDataA,
        headers: { ...headers, ...formDataA.getHeaders()},
        redirect: 'manual',
    });

    const formDataB = new FormData();
    formDataB.append('map', fs.createReadStream(FIXTURE_MAP));
    await fetch(`${address}/map/buzz/5.2.2`, {
        method: 'PUT',
        body: formDataB,
        headers: { ...headers, ...formDataB.getHeaders()},
        redirect: 'manual',
    });

    const formDataC = new FormData();
    formDataC.append('map', fs.createReadStream(FIXTURE_MAP));
    await fetch(`${address}/map/buzz/4.9.2`, {
        method: 'PUT',
        body: formDataC,
        headers: { ...headers, ...formDataC.getHeaders()},
        redirect: 'manual',
    });

    // GET map from server
    const downloaded = await fetch(`${address}/map/buzz`, {
        method: 'GET',
    });

    const downloadedResponse = await downloaded.json();

    t.equal(downloaded.status, 200, 'on GET of map versions, server should respond with 200 ok');
    t.matchSnapshot(downloadedResponse, 'on GET of map versions, response should match snapshot');
});
