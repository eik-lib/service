#!/usr/bin/env node

const fastify = require('fastify');
const Eik = require("..");

const run = async () => {
    const eik = new Eik();

    const app = fastify({
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

    await app.listen(eik.config.get('http.port'), eik.config.get('http.address'));
}
run();
