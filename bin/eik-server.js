#!/usr/bin/env node

import Fastify from 'fastify'
import Eik from '../lib/main.js';

const eik = new Eik();

const app = Fastify({
    ignoreTrailingSlash: true,
    modifyCoreObjects: false,
    trustProxy: true,
    http2: eik.config.get('http.http2'),
});

app.register(eik.api());

try {
    await eik.health();
} catch (error) {
    // Do accept errors
}

await app.listen({
    port: eik.config.get('http.port'),
    host: eik.config.get('http.address')
});
