import FormData from 'form-data';
import Fastify from 'fastify';
import fetch from 'node-fetch';
import tap from 'tap';

import Server from '../lib/main.js';
import Sink from '../node_modules/@eik/core/lib/sinks/test.js';

tap.test('404 - POST request to non existing pathname', async (t) => {
    const sink = new Sink();
    const service = new Server({ customSink: sink });

    const app = Fastify({
        ignoreTrailingSlash: true,
    });
    app.register(service.api());

    const address = await app.listen(0, 'localhost');

    const formData = new FormData();
    formData.append('key', 'change_me');

    const response = await fetch(`${address}/non/existent`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
    });
  
    t.equal(response.status, 404, 'server should respond with a 404 Not found');
    t.equal(response.headers.get('cache-control'), 'no-store', 'should contain "cache-control" set to "no-store"');

    await app.close();
});

tap.test('404 - GET request to non existing pathname', async (t) => {
    const sink = new Sink();
    const service = new Server({ customSink: sink });

    const app = Fastify({
        ignoreTrailingSlash: true,
    });
    app.register(service.api());

    const address = await app.listen(0, 'localhost');

    const response = await fetch(`${address}/non/existent`);
  
    t.equal(response.status, 404, 'server should respond with a 404 Not found');
    t.equal(response.headers.get('cache-control'), 'no-store', 'should contain "cache-control" set to "no-store"');

    await app.close();
});
