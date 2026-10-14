import fastify from "fastify";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import Sink from "./utils/sink.js";
import Server from "../lib/main.js";

/** @type {import('fastify').FastifyInstance} */
let app;
/** @type {Sink} */
let sink;

before(async () => {
	sink = new Sink();
	const service = new Server({ sink });

	app = fastify({
		routerOptions: { ignoreTrailingSlash: true },
		forceCloseConnections: true,
	});
	app.register(service.readApi());

	await app.listen({ port: 0, host: "127.0.0.1" });
});

after(async () => {
	await app.close();
});

// The behaviour for DELETE, POST and PUT routes is verified in the
// individual tests for the asset types. This test only verifies route registration works as intended.
test("readApi - DELETE, POST or PUT routes are NOT registered", async () => {
	const routeTree = app.printRoutes();

	assert.ok(
		!routeTree.includes("DELETE"),
		"readApi should not have any DELETE routes registered",
	);
	assert.ok(
		!routeTree.includes("POST"),
		"readApi should not have any POST routes registered",
	);
	assert.ok(
		!routeTree.includes("PUT"),
		"readApi should not have any PUT routes registered",
	);
});
