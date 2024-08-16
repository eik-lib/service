import FormData from 'form-data';
import fastify from 'fastify';
import fetch from 'node-fetch';
import path from 'path';
import tap from 'tap';
import url from 'url';
import fs from 'fs';

import Sink from './utils/sink.js';
import Server from '../lib/main.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const FIXTURE_PKG = path.resolve(__dirname, '..', 'fixtures', 'archive.tgz');

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

tap.test('400 - GET request with non-existing hostname', async (t) => {
    let formData = new FormData();
    formData.append('key', 'change_me');

    const res = await fetch(`${address}/auth/login`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
    });

    const { token } = /** @type {{ token: string }} */ (await res.json());

    formData = new FormData();
    formData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server so we don't get 404
    const uploaded = await fetch(`${address}/pkg/@cuz/fuzz/1.4.8`, {
        method: 'PUT',
        body: formData,
        redirect: 'manual',
        headers: { ...formData.getHeaders(), Authorization: `Bearer ${token}` },
    });

    t.equal(
        uploaded.status,
        303,
        'on PUT of package, server should respond with a 303 redirect',
    );
    t.equal(
        uploaded.headers.get('location'),
        `/pkg/@cuz/fuzz/1.4.8`,
        'on PUT of package, server should respond with a location header',
    );

    // GET file from server
    const response = await fetch(
        `${address}/pkg/@cuz/fuzz/1.4.8/main/index.js`,
        {
            method: 'GET',
            headers: {
                Host: 'leethaxorz.ai',
            },
        },
    );

    t.equal(
        response.status,
        400,
        'server should respond with a 400 Bad Request',
    );
});
