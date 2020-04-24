#!/usr/bin/env node

const fastify = require('fastify');
const config = require('../lib/config');
const Eik = require("..");

const run = async () => {
    const eik = new Eik();

    const app = fastify({
        ignoreTrailingSlash: true,
        modifyCoreObjects: false,
        trustProxy: true,
        http2: config.get('http.http2'),
    });

    app.register(eik.api());

    await app.listen(config.get('http.port'), config.get('http.address'));
}
run();
