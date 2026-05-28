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

test('auth - authenticate - legal "key" value', async () => {
	const formData = new FormData();
	formData.append("key", "change_me");

	const response = await fetch(`${address}/auth/login`, {
		method: "POST",
		body: formData,
	});

	const { token } = /** @type {{ token: string }} */ (await response.json());

	assert.strictEqual(
		response.status,
		200,
		"on POST of valid key, server should respond with a 200 OK",
	);
	assert.ok(
		token.length > 5,
		"on POST of valid key, server should respond with a body with a token",
	);
});

test('auth - authenticate - illegal "key" value', async () => {
	const formData = new FormData();
	formData.append("key", "error_me");

	const response = await fetch(`${address}/auth/login`, {
		method: "POST",
		body: formData,
	});

	assert.strictEqual(
		response.status,
		401,
		"on POST of valid key, server should respond with a 401 Unauthorized",
	);
});
