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

test("authApi - authenticate - legal key value", async () => {
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

test("authApi - authenticate - illegal key value", async () => {
	const formData = new FormData();
	formData.append("key", "error_me");

	const response = await fetch(`${address}/auth/login`, {
		method: "POST",
		body: formData,
	});

	assert.strictEqual(
		response.status,
		401,
		"on POST of invalid key, server should respond with a 401 Unauthorized",
	);
});

test("authApi - POST /auth/login route is available", async () => {
	const routeTree = app.printRoutes();

	assert.ok(
		routeTree.includes("auth/login (POST)"),
		"authApi should have POST /auth/login route registered",
	);
});

test("authApi - no PUT routes registered for /auth", async () => {
	const routeTree = app.printRoutes();
	const authLines = routeTree
		.split("\n")
		.filter((line) => line.includes("auth"));

	const hasPut = authLines.some((line) => line.includes("PUT"));

	assert.ok(
		!hasPut,
		"authApi should not have PUT routes for /auth",
	);
});

test("authApi - no DELETE routes registered for /auth", async () => {
	const routeTree = app.printRoutes();
	const authLines = routeTree
		.split("\n")
		.filter((line) => line.includes("auth"));

	const hasDelete = authLines.some((line) => line.includes("DELETE"));

	assert.ok(
		!hasDelete,
		"authApi should not have DELETE routes for /auth",
	);
});
