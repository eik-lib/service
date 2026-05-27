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

test("404 - POST request to non existing pathname", async () => {
	const formData = new FormData();
	formData.append("key", "change_me");

	const response = await fetch(`${address}/non/existent`, {
		method: "POST",
		body: formData,
	});

	assert.strictEqual(
		response.status,
		404,
		"server should respond with a 404 Not found",
	);
	assert.strictEqual(
		response.headers.get("cache-control"),
		"public, max-age=5",
		'should contain "cache-control" set to "public, max-age=5"',
	);
});

test("404 - GET request to non existing pathname", async () => {
	const response = await fetch(`${address}/non/existent`);

	assert.strictEqual(
		response.status,
		404,
		"server should respond with a 404 Not found",
	);
	assert.strictEqual(
		response.headers.get("cache-control"),
		"public, max-age=5",
		'should contain "cache-control" set to "public, max-age=5"',
	);
});
