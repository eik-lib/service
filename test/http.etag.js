'use strict';

const { test } = require('tap');
const fetch = require('node-fetch');

const Server = require('../../services/fastify');
const Sink = require('../../lib/sinks/test');

//
// Package GET
//

test('ETag - pkg:get - ETag and "If-None-Match" is matching', async t => {
    const sink = new Sink();
    const service = new Server({ customSink: sink, port: 0, logger: false });
    const address = await service.start();

    const url = `${address}/pkg/fuzz/8.4.1/main/index.js`;
    sink.set('/local/pkg/fuzz/8.4.1/main/index.js', 'hello world');

    const resA = await fetch(url, {
        method: 'GET',
    });
    const bodyA = await resA.text();

    t.true(resA.headers.get('etag'), 'first response should contain a ETag');
    t.equals(resA.status, 200, 'first response should respond with http status 200');
    t.equals(bodyA, 'hello world', 'first response should respond with file contents');

    const resB = await fetch(url, {
        method: 'GET',
        headers: {
            'If-None-Match': resA.headers.get('etag'),
        },
    });
    const bodyB = await resB.text();

    t.true(resB.headers.get('etag'), 'second response should contain a ETag');
    t.equals(resB.status, 304, 'second response should respond with http status 304');
    t.equals(bodyB, '', 'second response should respond with empty contents');

    await service.stop();
});

test('ETag - pkg:get - ETag and "If-None-Match" is NOT matching', async t => {
    const sink = new Sink();
    const service = new Server({ customSink: sink, port: 0, logger: false });
    const address = await service.start();

    const url = `${address}/pkg/fuzz/8.4.1/main/index.js`;
    sink.set('/local/pkg/fuzz/8.4.1/main/index.js', 'hello world');

    const resA = await fetch(url, {
        method: 'GET',
    });
    const bodyA = await resA.text();

    t.true(resA.headers.get('etag'), 'first response should contain a ETag');
    t.equals(resA.status, 200, 'first response should respond with http status 200');
    t.equals(bodyA, 'hello world', 'first response should respond with file contents');

    const resB = await fetch(url, {
        method: 'GET',
        headers: {
            'If-None-Match': '5eb63bbbe01eeed-xxxxxxxxx',
        },
    });
    const bodyB = await resB.text();

    t.true(resB.headers.get('etag'), 'second response should contain a ETag');
    t.equals(resB.status, 200, 'second response should respond with http status 200');
    t.equals(bodyB, 'hello world', 'second response should respond with file contents');

    await service.stop();
});

test('ETag - pkg:get - "If-None-Match" is NOT set on request', async t => {
    const sink = new Sink();
    const service = new Server({ customSink: sink, port: 0, logger: false });
    const address = await service.start();

    const url = `${address}/pkg/fuzz/8.4.1/main/index.js`;
    sink.set('/local/pkg/fuzz/8.4.1/main/index.js', 'hello world');

    const resA = await fetch(url, {
        method: 'GET',
    });
    const bodyA = await resA.text();

    t.true(resA.headers.get('etag'), 'first response should contain a ETag');
    t.equals(resA.status, 200, 'first response should respond with http status 200');
    t.equals(bodyA, 'hello world', 'first response should respond with file contents');

    const resB = await fetch(url, {
        method: 'GET',
    });
    const bodyB = await resB.text();

    t.true(resB.headers.get('etag'), 'second response should contain a ETag');
    t.equals(resB.status, 200, 'second response should respond with http status 200');
    t.equals(bodyB, 'hello world', 'second response should respond with file contents');

    await service.stop();
});

test('ETag - pkg:get - ETags is configured to not be set', async t => {
    const sink = new Sink();
    const service = new Server({ customSink: sink, port: 0, config: { etag: false }, logger: false });
    const address = await service.start();

    const url = `${address}/pkg/fuzz/8.4.1/main/index.js`;
    sink.set('/local/pkg/fuzz/8.4.1/main/index.js', 'hello world');

    const resA = await fetch(url, {
        method: 'GET',
    });
    const bodyA = await resA.text();

    t.false(resA.headers.get('etag'), 'first response should NOT contain a ETag');
    t.equals(resA.status, 200, 'first response should respond with http status 200');
    t.equals(bodyA, 'hello world', 'first response should respond with file contents');

    const resB = await fetch(url, {
        method: 'GET',
        headers: {
            'If-None-Match': resA.headers.get('etag'),
        },
    });

    const bodyB = await resB.text();

    t.false(resB.headers.get('etag'), 'second response should NOT contain a ETag');
    t.equals(resB.status, 200, 'second response should respond with http status 200');
    t.equals(bodyB, 'hello world', 'second response should respond with file contents');

    await service.stop();
});

//
// Package LOG
//

test('ETag - pkg:log - ETag and "If-None-Match" is matching', async t => {
    const sink = new Sink();
    const service = new Server({ customSink: sink, port: 0, logger: false });
    const address = await service.start();

    const url = `${address}/pkg/fuzz/8.4.1`;
    sink.set('/local/pkg/fuzz/8.4.1.package.json', 'hello world');


    const resA = await fetch(url, {
        method: 'GET',
    });
    const bodyA = await resA.text();

    t.true(resA.headers.get('etag'), 'first response should contain a ETag');
    t.equals(resA.status, 200, 'first response should respond with http status 200');
    t.equals(bodyA, 'hello world', 'first response should respond with file contents');

    const resB = await fetch(url, {
        method: 'GET',
        headers: {
            'If-None-Match': resA.headers.get('etag'),
        },
    });
    const bodyB = await resB.text();

    t.true(resB.headers.get('etag'), 'second response should contain a ETag');
    t.equals(resB.status, 304, 'second response should respond with http status 304');
    t.equals(bodyB, '', 'second response should respond with empty contents');

    await service.stop();
});

test('ETag - pkg:log - ETag and "If-None-Match" is NOT matching', async t => {
    const sink = new Sink();
    const service = new Server({ customSink: sink, port: 0, logger: false });
    const address = await service.start();

    const url = `${address}/pkg/fuzz/8.4.1`;
    sink.set('/local/pkg/fuzz/8.4.1.package.json', 'hello world');

    const resA = await fetch(url, {
        method: 'GET',
    });
    const bodyA = await resA.text();

    t.true(resA.headers.get('etag'), 'first response should contain a ETag');
    t.equals(resA.status, 200, 'first response should respond with http status 200');
    t.equals(bodyA, 'hello world', 'first response should respond with file contents');

    const resB = await fetch(url, {
        method: 'GET',
        headers: {
            'If-None-Match': '5eb63bbbe01eeed-xxxxxxxxx',
        },
    });
    const bodyB = await resB.text();

    t.true(resB.headers.get('etag'), 'second response should contain a ETag');
    t.equals(resB.status, 200, 'second response should respond with http status 200');
    t.equals(bodyB, 'hello world', 'second response should respond with file contents');

    await service.stop();
});

test('ETag - pkg:log - "If-None-Match" is NOT set on request', async t => {
    const sink = new Sink();
    const service = new Server({ customSink: sink, port: 0, logger: false });
    const address = await service.start();

    const url = `${address}/pkg/fuzz/8.4.1`;
    sink.set('/local/pkg/fuzz/8.4.1.package.json', 'hello world');

    const resA = await fetch(url, {
        method: 'GET',
    });
    const bodyA = await resA.text();

    t.true(resA.headers.get('etag'), 'first response should contain a ETag');
    t.equals(resA.status, 200, 'first response should respond with http status 200');
    t.equals(bodyA, 'hello world', 'first response should respond with file contents');

    const resB = await fetch(url, {
        method: 'GET',
    });
    const bodyB = await resB.text();

    t.true(resB.headers.get('etag'), 'second response should contain a ETag');
    t.equals(resB.status, 200, 'second response should respond with http status 200');
    t.equals(bodyB, 'hello world', 'second response should respond with file contents');

    await service.stop();
});

test('ETag - pkg:log - ETags is configured to not be set', async t => {
    const sink = new Sink();
    const service = new Server({ customSink: sink, port: 0, config: { etag: false }, logger: false });
    const address = await service.start();

    const url = `${address}/pkg/fuzz/8.4.1`;
    sink.set('/local/pkg/fuzz/8.4.1.package.json', 'hello world');

    const resA = await fetch(url, {
        method: 'GET',
    });
    const bodyA = await resA.text();

    t.false(resA.headers.get('etag'), 'first response should NOT contain a ETag');
    t.equals(resA.status, 200, 'first response should respond with http status 200');
    t.equals(bodyA, 'hello world', 'first response should respond with file contents');

    const resB = await fetch(url, {
        method: 'GET',
        headers: {
            'If-None-Match': resA.headers.get('etag'),
        },
    });

    const bodyB = await resB.text();

    t.false(resB.headers.get('etag'), 'second response should NOT contain a ETag');
    t.equals(resB.status, 200, 'second response should respond with http status 200');
    t.equals(bodyB, 'hello world', 'second response should respond with file contents');

    await service.stop();
});

//
// Map GET
//

test('ETag - map:get - ETag and "If-None-Match" is matching', async t => {
    const sink = new Sink();
    const service = new Server({ customSink: sink, port: 0, logger: false });
    const address = await service.start();

    const url = `${address}/map/buzz/4.2.2`;
    sink.set('/local/map/buzz/4.2.2.import-map.json', 'hello world');


    const resA = await fetch(url, {
        method: 'GET',
    });
    const bodyA = await resA.text();

    t.true(resA.headers.get('etag'), 'first response should contain a ETag');
    t.equals(resA.status, 200, 'first response should respond with http status 200');
    t.equals(bodyA, 'hello world', 'first response should respond with file contents');

    const resB = await fetch(url, {
        method: 'GET',
        headers: {
            'If-None-Match': resA.headers.get('etag'),
        },
    });
    const bodyB = await resB.text();

    t.true(resB.headers.get('etag'), 'second response should contain a ETag');
    t.equals(resB.status, 304, 'second response should respond with http status 304');
    t.equals(bodyB, '', 'second response should respond with empty contents');

    await service.stop();
});

test('ETag - map:get - ETag and "If-None-Match" is NOT matching', async t => {
    const sink = new Sink();
    const service = new Server({ customSink: sink, port: 0, logger: false });
    const address = await service.start();

    const url = `${address}/map/buzz/4.2.2`;
    sink.set('/local/map/buzz/4.2.2.import-map.json', 'hello world');

    const resA = await fetch(url, {
        method: 'GET',
    });
    const bodyA = await resA.text();

    t.true(resA.headers.get('etag'), 'first response should contain a ETag');
    t.equals(resA.status, 200, 'first response should respond with http status 200');
    t.equals(bodyA, 'hello world', 'first response should respond with file contents');

    const resB = await fetch(url, {
        method: 'GET',
        headers: {
            'If-None-Match': '5eb63bbbe01eeed-xxxxxxxxx',
        },
    });
    const bodyB = await resB.text();

    t.true(resB.headers.get('etag'), 'second response should contain a ETag');
    t.equals(resB.status, 200, 'second response should respond with http status 200');
    t.equals(bodyB, 'hello world', 'second response should respond with file contents');

    await service.stop();
});

test('ETag - map:get - "If-None-Match" is NOT set on request', async t => {
    const sink = new Sink();
    const service = new Server({ customSink: sink, port: 0, logger: false });
    const address = await service.start();

    const url = `${address}/map/buzz/4.2.2`;
    sink.set('/local/map/buzz/4.2.2.import-map.json', 'hello world');

    const resA = await fetch(url, {
        method: 'GET',
    });
    const bodyA = await resA.text();

    t.true(resA.headers.get('etag'), 'first response should contain a ETag');
    t.equals(resA.status, 200, 'first response should respond with http status 200');
    t.equals(bodyA, 'hello world', 'first response should respond with file contents');

    const resB = await fetch(url, {
        method: 'GET',
    });
    const bodyB = await resB.text();

    t.true(resB.headers.get('etag'), 'second response should contain a ETag');
    t.equals(resB.status, 200, 'second response should respond with http status 200');
    t.equals(bodyB, 'hello world', 'second response should respond with file contents');

    await service.stop();
});

test('ETag - map:get - ETags is configured to not be set', async t => {
    const sink = new Sink();
    const service = new Server({ customSink: sink, port: 0, config: { etag: false }, logger: false });
    const address = await service.start();

    const url = `${address}/map/buzz/4.2.2`;
    sink.set('/local/map/buzz/4.2.2.import-map.json', 'hello world');

    const resA = await fetch(url, {
        method: 'GET',
    });
    const bodyA = await resA.text();

    t.false(resA.headers.get('etag'), 'first response should NOT contain a ETag');
    t.equals(resA.status, 200, 'first response should respond with http status 200');
    t.equals(bodyA, 'hello world', 'first response should respond with file contents');

    const resB = await fetch(url, {
        method: 'GET',
        headers: {
            'If-None-Match': resA.headers.get('etag'),
        },
    });

    const bodyB = await resB.text();

    t.false(resB.headers.get('etag'), 'second response should NOT contain a ETag');
    t.equals(resB.status, 200, 'second response should respond with http status 200');
    t.equals(bodyB, 'hello world', 'second response should respond with file contents');

    await service.stop();
});
