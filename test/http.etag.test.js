import fastify from "fastify";
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";

import Sink from "./utils/sink.js";
import Server from "../lib/main.js";

/** @type {import('fastify').FastifyInstance} */
let app;
/** @type {string} */
let address;
/** @type {Sink} */
let sink;

before(async () => {
	sink = new Sink();
	const service = new Server({ sink });

	app = fastify({
		routerOptions: { ignoreTrailingSlash: true },
		forceCloseConnections: true,
	});
	app.register(service.api());

	address = await app.listen({ port: 0, host: "127.0.0.1" });
});

afterEach(() => {
	sink.clear();
});

after(async () => {
	await app.close();
});

//
// Package GET
//

test('ETag - pkg:get - ETag and "If-None-Match" is matching', async () => {
	const url = `${address}/pkg/fuzz/8.4.1/main/index.js`;
	sink.set("/local/pkg/fuzz/8.4.1/main/index.js", "hello world");

	const resA = await fetch(url, {
		method: "GET",
	});
	const bodyA = await resA.text();

	assert.ok(resA.headers.get("etag"), "first response should contain a ETag");
	assert.strictEqual(
		resA.status,
		200,
		"first response should respond with http status 200",
	);
	assert.strictEqual(
		bodyA,
		"hello world",
		"first response should respond with file contents",
	);

	const resB = await fetch(url, {
		method: "GET",
		headers: {
			"If-None-Match": resA.headers.get("etag") || "",
		},
	});
	const bodyB = await resB.text();

	assert.ok(resB.headers.get("etag"), "second response should contain a ETag");
	assert.strictEqual(
		resB.status,
		304,
		"second response should respond with http status 304",
	);
	assert.strictEqual(
		bodyB,
		"",
		"second response should respond with empty contents",
	);
});

test('ETag - pkg:get - ETag and "If-None-Match" is NOT matching', async () => {
	const url = `${address}/pkg/fuzz/8.4.1/main/index.js`;
	sink.set("/local/pkg/fuzz/8.4.1/main/index.js", "hello world");

	const resA = await fetch(url, {
		method: "GET",
	});
	const bodyA = await resA.text();

	assert.ok(resA.headers.get("etag"), "first response should contain a ETag");
	assert.strictEqual(
		resA.status,
		200,
		"first response should respond with http status 200",
	);
	assert.strictEqual(
		bodyA,
		"hello world",
		"first response should respond with file contents",
	);

	const resB = await fetch(url, {
		method: "GET",
		headers: {
			"If-None-Match": "5eb63bbbe01eeed-xxxxxxxxx",
		},
	});
	const bodyB = await resB.text();

	assert.ok(resB.headers.get("etag"), "second response should contain a ETag");
	assert.strictEqual(
		resB.status,
		200,
		"second response should respond with http status 200",
	);
	assert.strictEqual(
		bodyB,
		"hello world",
		"second response should respond with file contents",
	);
});

test('ETag - pkg:get - "If-None-Match" is NOT set on request', async () => {
	const url = `${address}/pkg/fuzz/8.4.1/main/index.js`;
	sink.set("/local/pkg/fuzz/8.4.1/main/index.js", "hello world");

	const resA = await fetch(url, {
		method: "GET",
	});
	const bodyA = await resA.text();

	assert.ok(resA.headers.get("etag"), "first response should contain a ETag");
	assert.strictEqual(
		resA.status,
		200,
		"first response should respond with http status 200",
	);
	assert.strictEqual(
		bodyA,
		"hello world",
		"first response should respond with file contents",
	);

	const resB = await fetch(url, {
		method: "GET",
	});
	const bodyB = await resB.text();

	assert.ok(resB.headers.get("etag"), "second response should contain a ETag");
	assert.strictEqual(
		resB.status,
		200,
		"second response should respond with http status 200",
	);
	assert.strictEqual(
		bodyB,
		"hello world",
		"second response should respond with file contents",
	);
});

//
// Package LOG
//

test('ETag - pkg:log - ETag and "If-None-Match" is matching', async () => {
	const url = `${address}/pkg/fuzz/8.4.1`;
	sink.set("/local/pkg/fuzz/8.4.1.package.json", "hello world");

	const resA = await fetch(url, {
		method: "GET",
	});
	const bodyA = await resA.text();

	assert.ok(resA.headers.get("etag"), "first response should contain a ETag");
	assert.strictEqual(
		resA.status,
		200,
		"first response should respond with http status 200",
	);
	assert.strictEqual(
		bodyA,
		"hello world",
		"first response should respond with file contents",
	);

	const resB = await fetch(url, {
		method: "GET",
		headers: {
			"If-None-Match": resA.headers.get("etag") || "",
		},
	});
	const bodyB = await resB.text();

	assert.ok(resB.headers.get("etag"), "second response should contain a ETag");
	assert.strictEqual(
		resB.status,
		304,
		"second response should respond with http status 304",
	);
	assert.strictEqual(
		bodyB,
		"",
		"second response should respond with empty contents",
	);
});

test('ETag - pkg:log - ETag and "If-None-Match" is NOT matching', async () => {
	const url = `${address}/pkg/fuzz/8.4.1`;
	sink.set("/local/pkg/fuzz/8.4.1.package.json", "hello world");

	const resA = await fetch(url, {
		method: "GET",
	});
	const bodyA = await resA.text();

	assert.ok(resA.headers.get("etag"), "first response should contain a ETag");
	assert.strictEqual(
		resA.status,
		200,
		"first response should respond with http status 200",
	);
	assert.strictEqual(
		bodyA,
		"hello world",
		"first response should respond with file contents",
	);

	const resB = await fetch(url, {
		method: "GET",
		headers: {
			"If-None-Match": "5eb63bbbe01eeed-xxxxxxxxx",
		},
	});
	const bodyB = await resB.text();

	assert.ok(resB.headers.get("etag"), "second response should contain a ETag");
	assert.strictEqual(
		resB.status,
		200,
		"second response should respond with http status 200",
	);
	assert.strictEqual(
		bodyB,
		"hello world",
		"second response should respond with file contents",
	);
});

test('ETag - pkg:log - "If-None-Match" is NOT set on request', async () => {
	const url = `${address}/pkg/fuzz/8.4.1`;
	sink.set("/local/pkg/fuzz/8.4.1.package.json", "hello world");

	const resA = await fetch(url, {
		method: "GET",
	});
	const bodyA = await resA.text();

	assert.ok(resA.headers.get("etag"), "first response should contain a ETag");
	assert.strictEqual(
		resA.status,
		200,
		"first response should respond with http status 200",
	);
	assert.strictEqual(
		bodyA,
		"hello world",
		"first response should respond with file contents",
	);

	const resB = await fetch(url, {
		method: "GET",
	});
	const bodyB = await resB.text();

	assert.ok(resB.headers.get("etag"), "second response should contain a ETag");
	assert.strictEqual(
		resB.status,
		200,
		"second response should respond with http status 200",
	);
	assert.strictEqual(
		bodyB,
		"hello world",
		"second response should respond with file contents",
	);
});

//
// Map GET
//

test('ETag - map:get - ETag and "If-None-Match" is matching', async () => {
	const url = `${address}/map/buzz/4.2.2`;
	sink.set("/local/map/buzz/4.2.2.import-map.json", "hello world");

	const resA = await fetch(url, {
		method: "GET",
	});
	const bodyA = await resA.text();

	assert.ok(resA.headers.get("etag"), "first response should contain a ETag");
	assert.strictEqual(
		resA.status,
		200,
		"first response should respond with http status 200",
	);
	assert.strictEqual(
		bodyA,
		"hello world",
		"first response should respond with file contents",
	);

	const resB = await fetch(url, {
		method: "GET",
		headers: {
			"If-None-Match": resA.headers.get("etag") || "",
		},
	});
	const bodyB = await resB.text();

	assert.ok(resB.headers.get("etag"), "second response should contain a ETag");
	assert.strictEqual(
		resB.status,
		304,
		"second response should respond with http status 304",
	);
	assert.strictEqual(
		bodyB,
		"",
		"second response should respond with empty contents",
	);
});

test('ETag - map:get - ETag and "If-None-Match" is NOT matching', async () => {
	const url = `${address}/map/buzz/4.2.2`;
	sink.set("/local/map/buzz/4.2.2.import-map.json", "hello world");

	const resA = await fetch(url, {
		method: "GET",
	});
	const bodyA = await resA.text();

	assert.ok(resA.headers.get("etag"), "first response should contain a ETag");
	assert.strictEqual(
		resA.status,
		200,
		"first response should respond with http status 200",
	);
	assert.strictEqual(
		bodyA,
		"hello world",
		"first response should respond with file contents",
	);

	const resB = await fetch(url, {
		method: "GET",
		headers: {
			"If-None-Match": "5eb63bbbe01eeed-xxxxxxxxx",
		},
	});
	const bodyB = await resB.text();

	assert.ok(resB.headers.get("etag"), "second response should contain a ETag");
	assert.strictEqual(
		resB.status,
		200,
		"second response should respond with http status 200",
	);
	assert.strictEqual(
		bodyB,
		"hello world",
		"second response should respond with file contents",
	);
});

test('ETag - map:get - "If-None-Match" is NOT set on request', async () => {
	const url = `${address}/map/buzz/4.2.2`;
	sink.set("/local/map/buzz/4.2.2.import-map.json", "hello world");

	const resA = await fetch(url, {
		method: "GET",
	});
	const bodyA = await resA.text();

	assert.ok(resA.headers.get("etag"), "first response should contain a ETag");
	assert.strictEqual(
		resA.status,
		200,
		"first response should respond with http status 200",
	);
	assert.strictEqual(
		bodyA,
		"hello world",
		"first response should respond with file contents",
	);

	const resB = await fetch(url, {
		method: "GET",
	});
	const bodyB = await resB.text();

	assert.ok(resB.headers.get("etag"), "second response should contain a ETag");
	assert.strictEqual(
		resB.status,
		200,
		"second response should respond with http status 200",
	);
	assert.strictEqual(
		bodyB,
		"hello world",
		"second response should respond with file contents",
	);
});
