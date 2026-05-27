import http from "node:http";
import fastify from "fastify";
import path from "path";
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import url from "url";
import fs from "fs";

import Sink from "./utils/sink.js";
import Server from "../lib/main.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const FIXTURE_PKG = path.resolve(__dirname, "..", "fixtures", "archive.tgz");

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

test("400 - GET request with non-existing hostname", async () => {
	let formData = new FormData();
	formData.append("key", "change_me");

	const res = await fetch(`${address}/auth/login`, {
		method: "POST",
		body: formData,
	});

	const { token } = /** @type {{ token: string }} */ (await res.json());

	formData = new FormData();
	formData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server so we don't get 404
	const uploaded = await fetch(`${address}/pkg/@cuz/fuzz/1.4.8`, {
		method: "PUT",
		body: formData,
		redirect: "manual",
		headers: { Authorization: `Bearer ${token}` },
	});

	assert.strictEqual(
		uploaded.status,
		303,
		"on PUT of package, server should respond with a 303 redirect",
	);
	assert.strictEqual(
		uploaded.headers.get("location"),
		`/pkg/@cuz/fuzz/1.4.8`,
		"on PUT of package, server should respond with a location header",
	);

	// GET file from server with a non-existing hostname (native fetch forbids
	// setting the Host header, so use node:http directly)
	const { port, hostname } = new URL(address);
	const status = await new Promise((resolve) => {
		const req = http.request(
			{
				hostname,
				port,
				path: "/pkg/@cuz/fuzz/1.4.8/main/index.js",
				method: "GET",
				headers: { Host: "leethaxorz.ai" },
			},
			(res) => resolve(res.statusCode),
		);
		req.end();
	});

	assert.strictEqual(
		status,
		400,
		"server should respond with a 400 Bad Request",
	);
});
