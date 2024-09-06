import FormData from "form-data";
import fastify from "fastify";
import fetch from "node-fetch";
import tap from "tap";

import Sink from "./utils/sink.js";
import Server from "../lib/main.js";

/** @type {import('fastify').FastifyInstance} */
let app;
/** @type {string} */
let address;
/** @type {Sink} */
let sink;

tap.before(async () => {
	sink = new Sink();
	const service = new Server({ sink });

	app = fastify({
		ignoreTrailingSlash: true,
		forceCloseConnections: true,
	});
	app.register(service.api());

	address = await app.listen({ port: 0, host: "127.0.0.1" });
});

tap.afterEach(() => {
	sink.clear();
});

tap.teardown(async () => {
	await app.close();
});

tap.test("404 - POST request to non existing pathname", async (t) => {
	const formData = new FormData();
	formData.append("key", "change_me");

	const response = await fetch(`${address}/non/existent`, {
		method: "POST",
		body: formData,
		headers: formData.getHeaders(),
	});

	t.equal(response.status, 404, "server should respond with a 404 Not found");
	t.equal(
		response.headers.get("cache-control"),
		"public, max-age=5",
		'should contain "cache-control" set to "public, max-age=5"',
	);
});

tap.test("404 - GET request to non existing pathname", async (t) => {
	const response = await fetch(`${address}/non/existent`);

	t.equal(response.status, 404, "server should respond with a 404 Not found");
	t.equal(
		response.headers.get("cache-control"),
		"public, max-age=5",
		'should contain "cache-control" set to "public, max-age=5"',
	);
});
