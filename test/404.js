import FormData from 'form-data';
import Fastify from 'fastify';
import fetch from 'node-fetch';
import tap from 'tap';

import Sink from "@eik/core/lib/sinks/test.js";
import Server from '../lib/main.js';

tap.test('404 - POST request to non existing pathname', async (t) => {
    const sink = new Sink();
    const service = new Server({ customSink: sink });

    const app = Fastify({
        ignoreTrailingSlash: true,
    });
    app.register(service.api());

    const address = await app.listen({port: 0});

    const formData = new FormData();
    formData.append('key', 'change_me');

    const response = await fetch(`${address}/non/existent`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
    });
  
    t.equal(response.status, 404, 'server should respond with a 404 Not found');
    t.equal(response.headers.get('cache-control'), 'public, max-age=5', 'should contain "cache-control" set to "public, max-age=5"');

    await app.close();
});

tap.test('404 - GET request to non existing pathname', async (t) => {
    const sink = new Sink();
    const service = new Server({ customSink: sink });

    const app = Fastify({
        ignoreTrailingSlash: true,
    });
    app.register(service.api());

    const address = await app.listen({port: 0});

    const response = await fetch(`${address}/non/existent`);
  
    t.equal(response.status, 404, 'server should respond with a 404 Not found');
    t.equal(response.headers.get('cache-control'), 'public, max-age=5', 'should contain "cache-control" set to "public, max-age=5"');

    await app.close();
});
