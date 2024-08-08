import FormData from 'form-data';
import Fastify from 'fastify';
import fetch from 'node-fetch';
import tap from 'tap';

import Sink from '@eik/core/lib/sinks/test.js';
import Server from '../lib/main.js';

tap.test('auth - authenticate - legal "key" value', async (t) => {
    const sink = new Sink();
    const service = new Server({ customSink: sink });

    const app = Fastify({
        ignoreTrailingSlash: true,
    });
    app.register(service.api());

    const address = await app.listen({ port: 0, host: '127.0.0.1' });

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

    await app.close();
});

tap.test('auth - authenticate - illegal "key" value', async (t) => {
    const sink = new Sink();
    const service = new Server({ customSink: sink });

    const app = Fastify({
        ignoreTrailingSlash: true,
    });
    app.register(service.api());

    const address = await app.listen({ port: 0, host: '127.0.0.1' });

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

    await app.close();
});
