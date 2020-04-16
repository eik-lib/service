'use strict';

const { createReadStream } = require('fs');
const FormData = require('form-data');
const { join } = require('path');
const fetch = require('node-fetch');
const tap = require('tap');

const Server = require('../../services/fastify');
const Sink = require('../../lib/sinks/test');

// Ignore the timestamp for "created" field in the snapshots
tap.cleanSnapshot = (s) => {
    const regex = /"created": [0-9]+,/gi;
    return s.replace(regex, '"created": -1,');
};

const authentication = async (address) => {
    const formData = new FormData();
    formData.append('key', 'change_me');

    const res = await fetch(`${address}/auth/login`, {
        method: 'POST',
        body: formData,
        headers: formData.getHeaders(),
    });

    const { token } = await res.json();
    return { 'Authorization': `Bearer ${token}` };
}

tap.test('Sink is slow and irregular - Writing medium sized package', async t => {
    const sink = new Sink();

    // Simulate a slow write process by delaying each chunk written
    // to the sink with something between 10 and 100 + (buffer count) ms.
    sink.writeDelayChunks = (count) => {
        const max = 100 + count;
        const min = 10;
        return Math.floor(Math.random() * max) + min;
    };

    const service = new Server({ customSink: sink, logger: false, port: 0 });
    const address = await service.start();

    const headers = await authentication(address);

    const formData = new FormData();
    formData.append(
        'package',
        createReadStream(join(__dirname, '../../fixtures/archive.tgz')),
    );

    const res = await fetch(`${address}/pkg/frazz/2.1.4`, {
        method: 'PUT',
        body: formData,
        headers: { ...headers, ...formData.getHeaders()},
    });

    const obj = await res.json();
    t.matchSnapshot(obj, 'on GET of package, response should match snapshot');

    await service.stop();
});

tap.test('Sink is slow and irregular - Writing small sized package', async t => {
    const sink = new Sink();

    // Simulate a slow write process by delaying each chunk written
    // to the sink with something between 10 and 100 + (buffer count) ms.
    sink.writeDelayChunks = (count) => {
        const max = 100 + count;
        const min = 10;
        return Math.floor(Math.random() * max) + min;
    };

    const service = new Server({ customSink: sink, logger: false, port: 0 });
    const address = await service.start();

    const headers = await authentication(address);

    const formData = new FormData();
    formData.append(
        'package',
        createReadStream(join(__dirname, '../../fixtures/archive-small.tgz')),
    );

    const res = await fetch(`${address}/pkg/brazz/7.1.3`, {
        method: 'PUT',
        body: formData,
        // headers: formData.getHeaders(),
        headers: { ...headers, ...formData.getHeaders()},
    });

    const obj = await res.json();
    t.matchSnapshot(obj, 'on GET of package, response should match snapshot');

    await service.stop();
});

tap.test('Sink is slow to construct writer - Writing medium sized package', async t => {
    const sink = new Sink();

    // Simulate a slow creation of the sink write operation by delaying
    // it something between 20 and 100ms.
    sink.writeDelayResolve = () => {
        const max = 100;
        const min = 20;
        return Math.floor(Math.random() * max) + min;
    };

    const service = new Server({ customSink: sink, logger: false, port: 0 });
    const address = await service.start();

    const headers = await authentication(address);

    const formData = new FormData();
    formData.append(
        'package',
        createReadStream(join(__dirname, '../../fixtures/archive.tgz')),
    );

    const res = await fetch(`${address}/pkg/frazz/2.1.4`, {
        method: 'PUT',
        body: formData,
        headers: { ...headers, ...formData.getHeaders()},
    });

    const obj = await res.json();
    t.matchSnapshot(obj, 'on GET of package, response should match snapshot');

    await service.stop();
});

tap.test('Sink is slow to construct writer - Writing small sized package', async t => {
    const sink = new Sink();

    // Simulate a slow creation of the sink write operation by delaying
    // it something between 20 and 100ms.
    sink.writeDelayResolve = () => {
        const max = 100;
        const min = 20;
        return Math.floor(Math.random() * max) + min;
    };

    const service = new Server({ customSink: sink, logger: false, port: 0 });
    const address = await service.start();

    const headers = await authentication(address);

    const formData = new FormData();
    formData.append(
        'package',
        createReadStream(join(__dirname, '../../fixtures/archive-small.tgz')),
    );

    const res = await fetch(`${address}/pkg/brazz/7.1.3`, {
        method: 'PUT',
        body: formData,
        headers: { ...headers, ...formData.getHeaders()},
    });

    const obj = await res.json();
    t.matchSnapshot(obj, 'on GET of package, response should match snapshot');

    await service.stop();
});
