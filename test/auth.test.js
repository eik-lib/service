import FormData from 'form-data';
import fastify from 'fastify';
import fetch from 'node-fetch';
import tap from 'tap';

import Sink from './utils/sink.js';
import Server from '../lib/main.js';

/** @type {import('fastify').FastifyInstance} */
let app;
/** @type {string} */
let address;
/** @type {Sink} */
let sink;

tap.before(async () => {
    sink = new Sink();
    const service = new Server({ sink });

    app = fastify({
        ignoreTrailingSlash: true,
        forceCloseConnections: true,
    });
    app.register(service.api());

    address = await app.listen({ port: 0, host: '127.0.0.1' });
});

tap.afterEach(() => {
    sink.clear();
});

tap.teardown(async () => {
    await app.close();
});

tap.test('auth - authenticate - legal "key" value', async (t) => {
    const formData = new FormData();
    formData.append('key', 'change_me');

    const response = await fetch(`${address}/auth/login`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
    });

    const { token } = /** @type {{ token: string }} */ (await response.json());

    t.equal(
        response.status,
        200,
        'on POST of valid key, server should respond with a 200 OK',
    );
    t.ok(
        token.length > 5,
        'on POST of valid key, server should respond with a body with a token',
    );
});

tap.test('auth - authenticate - illegal "key" value', async (t) => {
    const formData = new FormData();
    formData.append('key', 'error_me');

    const response = await fetch(`${address}/auth/login`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
    });

    t.equal(
        response.status,
        401,
        'on POST of valid key, server should respond with a 401 Unauthorized',
    );
});
