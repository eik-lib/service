import FormData from 'form-data';
import fastify from 'fastify';
import fetch from 'node-fetch';
import path from 'path';
import tap from 'tap';
import url from 'url';
import fs from 'fs';

import Sink from '@eik/core/lib/sinks/test.js';
import Server from '../lib/main.js';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Ignore the timestamp for "created" field in the snapshots
tap.cleanSnapshot = (s) => {
    const regex = /"created": [0-9]+,/gi;
    return s.replace(regex, '"created": -1,');
};

/** @type {import('fastify').FastifyInstance} */
let app;
/** @type {string} */
let address;
/** @type {Record<string, string>} */
let headers;
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

    const formData = new FormData();
    formData.append('key', 'change_me');
    const res = await fetch(`${address}/auth/login`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
    });
    const login = /** @type {{ token: string }} */ (await res.json());
    headers = { Authorization: `Bearer ${login.token}` };
});

tap.afterEach(() => {
    sink.clear();
});

tap.teardown(async () => {
    await app.close();
});

tap.test(
    'Sink is slow and irregular - Writing medium sized package',
    async (t) => {
        t.setTimeout(20_000_000);

        // Simulate a slow write process by delaying each chunk written
        // to the sink with something between 10 and 100 + (buffer count) ms.
        sink.writeDelayChunks = (count) => {
            const max = 100 + count;
            const min = 10;
            return Math.floor(Math.random() * max) + min;
        };

        const formData = new FormData();
        formData.append(
            'package',
            fs.createReadStream(
                path.join(__dirname, '../fixtures/archive.tgz'),
            ),
        );

        const res = await fetch(`${address}/pkg/frazz/2.1.4`, {
            method: 'PUT',
            body: formData,
            headers: { ...headers, ...formData.getHeaders() },
        });

        const obj = await res.json();
        t.matchSnapshot(
            obj,
            'on GET of package, response should match snapshot',
        );
    },
);

tap.test(
    'Sink is slow and irregular - Writing small sized package',
    async (t) => {
        t.setTimeout(20_000_000);

        // Simulate a slow write process by delaying each chunk written
        // to the sink with something between 10 and 100 + (buffer count) ms.
        sink.writeDelayChunks = (count) => {
            const max = 100 + count;
            const min = 10;
            return Math.floor(Math.random() * max) + min;
        };

        const formData = new FormData();
        formData.append(
            'package',
            fs.createReadStream(
                path.join(__dirname, '../fixtures/archive-small.tgz'),
            ),
        );

        const res = await fetch(`${address}/pkg/brazz/7.1.3`, {
            method: 'PUT',
            body: formData,
            headers: { ...headers, ...formData.getHeaders() },
        });

        const obj = await res.json();
        t.matchSnapshot(
            obj,
            'on GET of package, response should match snapshot',
        );
    },
);

tap.test(
    'Sink is slow to construct writer - Writing medium sized package',
    async (t) => {
        t.setTimeout(20_000_000);

        // Simulate a slow creation of the sink write operation by delaying
        // it something between 20 and 100ms.
        sink.writeDelayResolve = () => {
            const max = 100;
            const min = 20;
            return Math.floor(Math.random() * max) + min;
        };

        const formData = new FormData();
        formData.append(
            'package',
            fs.createReadStream(
                path.join(__dirname, '../fixtures/archive.tgz'),
            ),
        );

        const res = await fetch(`${address}/pkg/frazz/2.1.4`, {
            method: 'PUT',
            body: formData,
            headers: { ...headers, ...formData.getHeaders() },
        });

        const obj = await res.json();
        t.matchSnapshot(
            obj,
            'on GET of package, response should match snapshot',
        );
    },
);

tap.test(
    'Sink is slow to construct writer - Writing small sized package',
    async (t) => {
        t.setTimeout(20_000_000);

        // Simulate a slow creation of the sink write operation by delaying
        // it something between 20 and 100ms.
        sink.writeDelayResolve = () => {
            const max = 100;
            const min = 20;
            return Math.floor(Math.random() * max) + min;
        };

        const formData = new FormData();
        formData.append(
            'package',
            fs.createReadStream(
                path.join(__dirname, '../fixtures/archive-small.tgz'),
            ),
        );

        const res = await fetch(`${address}/pkg/brazz/7.1.3`, {
            method: 'PUT',
            body: formData,
            headers: { ...headers, ...formData.getHeaders() },
        });

        const obj = await res.json();
        t.matchSnapshot(
            obj,
            'on GET of package, response should match snapshot',
        );
    },
);
