import fastify from "fastify";
import { test, before, after } from "node:test";
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

after(async () => {
	await app.close();
});

test("publishingApi - PUT endpoint requires authentication", async () => {
	const formData = new FormData();
	formData.append("filedata", new Blob(["test content"]), "test.tar.gz");

	const response = await fetch(`${address}/pkg/test-pkg/1.0.0`, {
		method: "PUT",
		body: formData,
	});

	assert.strictEqual(
		response.status,
		401,
		"PUT request without authentication should respond with 401",
	);
});

test("publishingApi - POST endpoint requires authentication", async () => {
	const formData = new FormData();
	formData.append("version", "1.0.0");

	const response = await fetch(`${address}/pkg/test-pkg/v1`, {
		method: "POST",
		body: formData,
	});

	assert.strictEqual(
		response.status,
		401,
		"POST request without authentication should respond with 401",
	);
});

test("publishingApi - DELETE endpoint requires authentication", async () => {
	const response = await fetch(`${address}/pkg/test-pkg/v1`, {
		method: "DELETE",
	});

	assert.strictEqual(
		response.status,
		401,
		"DELETE request without authentication should respond with 401",
	);
});

test("publishingApi - has PUT, POST, DELETE routes registered", async () => {
	const routeTree = app.printRoutes();
	
	const hasPut = routeTree.includes(", PUT");
	const hasPost = routeTree.includes(", POST");
	const hasDelete = routeTree.includes(", DELETE");

	assert.ok(
		hasPut && hasPost && hasDelete,
		"publishingApi should have PUT, POST, and DELETE routes registered",
	);
});
