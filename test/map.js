'use strict';

const { test, beforeEach, afterEach } = require('tap');
const FormData = require('form-data');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const Server = require('../../services/fastify');
const Sink = require('../../lib/sinks/test');

const FIXTURE_MAP = path.resolve(__dirname, '../../fixtures/import-map.json');

beforeEach(async (done, t) => {
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

afterEach(async (done, t) => {
    await t.context.service.stop();
    done();
});

test('import-map - no auth token on PUT - scoped', async (t) => {
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

    t.equals(uploaded.status, 401, 'on PUT of map, server should respond with a 401 Unauthorized');
});

test('import-map - no auth token on PUT - non scoped', async (t) => {
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

    t.equals(uploaded.status, 401, 'on PUT of map, server should respond with a 401 Unauthorized');
});

test('import-map - put map -> get map - scoped successfully uploaded', async (t) => {
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

    t.equals(uploaded.status, 303, 'on PUT of map, server should respond with a 303 redirect');
    t.equals(uploaded.headers.get('location'), `${address}/map/@cuz/buzz/4.2.2`, 'on PUT of map, server should respond with a location header');

    // GET map from server
    const downloaded = await fetch(`${address}/map/@cuz/buzz/4.2.2`, {
        method: 'GET',
    });

    const downloadedResponse = await downloaded.json();

    t.equals(downloaded.status, 200, 'on GET of map, server should respond with 200 ok');
    t.matchSnapshot(downloadedResponse, 'on GET of map, response should match snapshot');
});

test('import-map - put map -> get map - non scoped successfully uploaded', async (t) => {
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

    t.equals(uploaded.status, 303, 'on PUT of map, server should respond with a 303 redirect');
    t.equals(uploaded.headers.get('location'), `${address}/map/buzz/4.2.2`, 'on PUT of map, server should respond with a location header');

    // GET map from server
    const downloaded = await fetch(`${address}/map/buzz/4.2.2`, {
        method: 'GET',
    });

    const downloadedResponse = await downloaded.json();

    t.equals(downloaded.status, 200, 'on GET of map, server should respond with 200 ok');
    t.matchSnapshot(downloadedResponse, 'on GET of map, response should match snapshot');
});

test('import-map - get map versions - scoped', async (t) => {
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

    t.equals(downloaded.status, 200, 'on GET of map versions, server should respond with 200 ok');
    t.matchSnapshot(downloadedResponse, 'on GET of map versions, response should match snapshot');
});

test('import-map - get map versions - non scoped', async (t) => {
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

    t.equals(downloaded.status, 200, 'on GET of map versions, server should respond with 200 ok');
    t.matchSnapshot(downloadedResponse, 'on GET of map versions, response should match snapshot');
});
