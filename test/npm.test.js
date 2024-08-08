import FormData from 'form-data';
import Fastify from 'fastify';
import fetch from 'node-fetch';
import path from 'path';
import tap from 'tap';
import url from 'url';
import fs from 'fs';

import Sink from '@eik/core/lib/sinks/test.js';
import Server from '../lib/main.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const FIXTURE_PKG = path.resolve(__dirname, '../fixtures/archive.tgz');

// Ignore the timestamp for "created" field in the snapshots
tap.cleanSnapshot = (s) => {
    const regex = /"created": [0-9]+,/gi;
    return s.replace(regex, '"created": -1,');
};

tap.beforeEach(async (t) => {
    const sink = new Sink();
    const service = new Server({ customSink: sink });

    const app = Fastify({
        ignoreTrailingSlash: true,
    });
    app.register(service.api());

    const address = await app.listen({ port: 0, host: '127.0.0.1' });

    const formData = new FormData();
    formData.append('key', 'change_me');

    const res = await fetch(`${address}/auth/login`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
    });

    const { token } = /** @type {{ token: string }} */ (await res.json());
    const headers = { Authorization: `Bearer ${token}` };

    t.context = {
        address,
        headers,
        app,
    };
});

tap.afterEach(async (t) => {
    await t.context.app.close();
});

tap.test('npm packages - no auth token on PUT - scoped', async (t) => {
    const { address } = t.context;

    const formData = new FormData();
    formData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    const uploaded = await fetch(`${address}/npm/@cuz/fuzz/1.4.8`, {
        method: 'PUT',
        body: formData,
        redirect: 'manual',
        headers: formData.getHeaders(),
    });

    t.equal(
        uploaded.status,
        401,
        'on PUT of package, server should respond with a 401 Unauthorized',
    );
});

tap.test('npm packages - no auth token on PUT - non scoped', async (t) => {
    const { address } = t.context;

    const formData = new FormData();
    formData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    const uploaded = await fetch(`${address}/npm/fuzz/1.4.8`, {
        method: 'PUT',
        body: formData,
        redirect: 'manual',
        headers: formData.getHeaders(),
    });

    t.equal(
        uploaded.status,
        401,
        'on PUT of package, server should respond with a 401 Unauthorized',
    );
});

tap.test(
    'npm packages - put pkg -> get file - scoped successfully uploaded',
    async (t) => {
        const { headers, address } = t.context;

        const formData = new FormData();
        formData.append('package', fs.createReadStream(FIXTURE_PKG));

        // PUT files on server
        const uploaded = await fetch(`${address}/npm/@cuz/fuzz/1.4.8`, {
            method: 'PUT',
            body: formData,
            redirect: 'manual',
            headers: { ...headers, ...formData.getHeaders() },
        });

        t.equal(
            uploaded.status,
            303,
            'on PUT of package, server should respond with a 303 redirect',
        );
        t.equal(
            uploaded.headers.get('location'),
            `/npm/@cuz/fuzz/1.4.8`,
            'on PUT of package, server should respond with a location header',
        );

        // GET file from server
        const downloaded = await fetch(
            `${address}/npm/@cuz/fuzz/1.4.8/main/index.js`,
            {
                method: 'GET',
            },
        );
        const downloadedResponse = await downloaded.text();

        t.equal(
            downloaded.status,
            200,
            'on GET of file, server should respond with 200 ok',
        );
        t.matchSnapshot(
            downloadedResponse,
            'on GET of package, response should match snapshot',
        );
    },
);

tap.test(
    'npm packages - put pkg -> get file - non scoped successfully uploaded',
    async (t) => {
        const { headers, address } = t.context;

        const formData = new FormData();
        formData.append('package', fs.createReadStream(FIXTURE_PKG));

        // PUT files on server
        const uploaded = await fetch(`${address}/npm/fuzz/8.4.1`, {
            method: 'PUT',
            body: formData,
            headers: { ...headers, ...formData.getHeaders() },
            redirect: 'manual',
        });

        t.equal(
            uploaded.status,
            303,
            'on PUT of package, server should respond with a 303 redirect',
        );
        t.equal(
            uploaded.headers.get('location'),
            `/npm/fuzz/8.4.1`,
            'on PUT of package, server should respond with a location header',
        );

        // GET file from server
        const downloaded = await fetch(
            `${address}/npm/fuzz/8.4.1/main/index.js`,
            {
                method: 'GET',
            },
        );
        const downloadedResponse = await downloaded.text();

        t.equal(
            downloaded.status,
            200,
            'on GET of file, server should respond with 200 ok',
        );
        t.matchSnapshot(
            downloadedResponse,
            'on GET of package, response should match snapshot',
        );
    },
);

tap.test('npm packages - get package overview - scoped', async (t) => {
    const { headers, address } = t.context;

    const formData = new FormData();
    formData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    const uploaded = await fetch(`${address}/npm/@cuz/fuzz/8.4.1/`, {
        method: 'PUT',
        body: formData,
        headers: { ...headers, ...formData.getHeaders() },
        redirect: 'manual',
    });

    t.equal(
        uploaded.status,
        303,
        'on PUT of package, server should respond with a 303 redirect',
    );
    t.equal(
        uploaded.headers.get('location'),
        `/npm/@cuz/fuzz/8.4.1`,
        'on PUT of package, server should respond with a location header',
    );

    // GET package overview from server
    const downloaded = await fetch(`${address}/npm/@cuz/fuzz/8.4.1/`, {
        method: 'GET',
    });
    const downloadedResponse = await downloaded.json();

    t.equal(
        downloaded.status,
        200,
        'on GET, server should respond with 200 ok',
    );
    t.matchSnapshot(
        downloadedResponse,
        'on GET, response should match snapshot',
    );
});

tap.test('npm packages - get package overview - non scoped', async (t) => {
    const { headers, address } = t.context;

    const formData = new FormData();
    formData.append('package', fs.createReadStream(FIXTURE_PKG));

    // PUT files on server
    const uploaded = await fetch(`${address}/npm/fuzz/8.4.1/`, {
        method: 'PUT',
        body: formData,
        headers: { ...headers, ...formData.getHeaders() },
        redirect: 'manual',
    });

    t.equal(
        uploaded.status,
        303,
        'on PUT of package, server should respond with a 303 redirect',
    );
    t.equal(
        uploaded.headers.get('location'),
        `/npm/fuzz/8.4.1`,
        'on PUT of package, server should respond with a location header',
    );

    // GET package overview from server
    const downloaded = await fetch(`${address}/npm/fuzz/8.4.1/`, {
        method: 'GET',
    });
    const downloadedResponse = await downloaded.json();

    t.equal(
        downloaded.status,
        200,
        'on GET, server should respond with 200 ok',
    );
    t.matchSnapshot(
        downloadedResponse,
        'on GET, response should match snapshot',
    );
});

tap.test('npm packages - get package versions - scoped', async (t) => {
    const { headers, address } = t.context;

    // PUT files on server

    const formDataA = new FormData();
    formDataA.append('package', fs.createReadStream(FIXTURE_PKG));
    await fetch(`${address}/npm/@cuz/fuzz/7.3.2/`, {
        method: 'PUT',
        body: formDataA,
        headers: { ...headers, ...formDataA.getHeaders() },
        redirect: 'manual',
    });

    const formDataB = new FormData();
    formDataB.append('package', fs.createReadStream(FIXTURE_PKG));
    await fetch(`${address}/npm/@cuz/fuzz/8.4.1/`, {
        method: 'PUT',
        body: formDataB,
        headers: { ...headers, ...formDataB.getHeaders() },
        redirect: 'manual',
    });

    const formDataC = new FormData();
    formDataC.append('package', fs.createReadStream(FIXTURE_PKG));
    await fetch(`${address}/npm/@cuz/fuzz/8.5.1/`, {
        method: 'PUT',
        body: formDataC,
        headers: { ...headers, ...formDataC.getHeaders() },
        redirect: 'manual',
    });

    // GET version overview from server
    const downloaded = await fetch(`${address}/npm/@cuz/fuzz/`, {
        method: 'GET',
    });
    const downloadedResponse = await downloaded.json();

    t.equal(
        downloaded.status,
        200,
        'on GET, server should respond with 200 ok',
    );
    t.matchSnapshot(
        downloadedResponse,
        'on GET, response should match snapshot',
    );
});

tap.test('npm packages - get package versions - non scoped', async (t) => {
    const { headers, address } = t.context;

    // PUT files on server

    const formDataA = new FormData();
    formDataA.append('package', fs.createReadStream(FIXTURE_PKG));
    await fetch(`${address}/npm/fuzz/7.3.2/`, {
        method: 'PUT',
        body: formDataA,
        headers: { ...headers, ...formDataA.getHeaders() },
        redirect: 'manual',
    });

    const formDataB = new FormData();
    formDataB.append('package', fs.createReadStream(FIXTURE_PKG));
    await fetch(`${address}/npm/fuzz/8.4.1/`, {
        method: 'PUT',
        body: formDataB,
        headers: { ...headers, ...formDataB.getHeaders() },
        redirect: 'manual',
    });

    const formDataC = new FormData();
    formDataC.append('package', fs.createReadStream(FIXTURE_PKG));
    await fetch(`${address}/npm/fuzz/8.5.1/`, {
        method: 'PUT',
        body: formDataC,
        headers: { ...headers, ...formDataC.getHeaders() },
        redirect: 'manual',
    });

    // GET version overview from server
    const downloaded = await fetch(`${address}/npm/fuzz/`, {
        method: 'GET',
    });
    const downloadedResponse = await downloaded.json();

    t.equal(
        downloaded.status,
        200,
        'on GET, server should respond with 200 ok',
    );
    t.matchSnapshot(
        downloadedResponse,
        'on GET, response should match snapshot',
    );
});
