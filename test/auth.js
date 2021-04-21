'use strict';

const FormData = require('form-data');
const fastify = require('fastify');
const fetch = require('node-fetch');
const tap = require('tap');

const Server = require("..");
const Sink = require('../node_modules/@eik/core/lib/sinks/test');

tap.test('auth - authenticate - legal "key" value', async (t) => {
    const sink = new Sink();
    const service = new Server({ customSink: sink });

    const app = fastify({
        ignoreTrailingSlash: true,
    });
    app.register(service.api());

    const address = await app.listen(0, 'localhost');

    const formData = new FormData();
    formData.append('key', 'change_me');

    const response = await fetch(`${address}/auth/login`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
    });

    const body = await response.json();

    t.equal(response.status, 200, 'on POST of valid key, server should respond with a 200 OK');
    t.ok(body.token.length > 5, 'on POST of valid key, server should respond with a body with a token');

    await app.close();
});

tap.test('auth - authenticate - illegal "key" value', async (t) => {
    const sink = new Sink();
    const service = new Server({ customSink: sink, port: 0, logger: false });

    const app = fastify({
        ignoreTrailingSlash: true,
    });
    app.register(service.api());

    const address = await app.listen(0, 'localhost');

    const formData = new FormData();
    formData.append('key', 'error_me');

    const response = await fetch(`${address}/auth/login`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
    });

    t.equal(response.status, 401, 'on POST of valid key, server should respond with a 401 Unauthorized');

    await app.close();
});
