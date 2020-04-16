'use strict';

const FormData = require('form-data');
const { test } = require('tap');
const fetch = require('node-fetch');

const Server = require('../../services/fastify');
const Sink = require('../../lib/sinks/test');

test('auth - authenticate - legal "key" value', async (t) => {
    const sink = new Sink();
    const service = new Server({ customSink: sink, port: 0, logger: false });
    const address = await service.start();

    const formData = new FormData();
    formData.append('key', 'change_me');

    const response = await fetch(`${address}/auth/login`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
    });

    const body = await response.json();

    t.equals(response.status, 200, 'on POST of valid key, server should respond with a 200 OK');
    t.true(body.token.length > 5, 'on POST of valid key, server should respond with a body with a token');

    await service.stop();
});

test('auth - authenticate - illegal "key" value', async (t) => {
    const sink = new Sink();
    const service = new Server({ customSink: sink, port: 0, logger: false });
    const address = await service.start();

    const formData = new FormData();
    formData.append('key', 'error_me');

    const response = await fetch(`${address}/auth/login`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
    });

    t.equals(response.status, 401, 'on POST of valid key, server should respond with a 401 Unauthorized');

    await service.stop();
});
