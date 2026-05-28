import fastify from "fastify";
import path from "path";
import { test, after } from "node:test";
import assert from "node:assert/strict";
import url from "url";
import fs from "fs";

import Sink from "./utils/sink.js";
import Server from "../lib/main.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const FIXTURE_PKG = path.resolve(__dirname, "..", "fixtures", "archive.tgz");

/** @type {import('fastify').FastifyInstance} */
let app;
/** @type {Sink} */
let sink;

after(async () => {
	sink.clear();
	await app.close();
});

test("compression - assets should have content-encoding: br", async () => {
	sink = new Sink();
	const service = new Server({ sink });

	app = fastify({
		routerOptions: { ignoreTrailingSlash: true },
		forceCloseConnections: true,
	});

	await app.register(service.api());

	const address = await app.listen({ port: 0, host: "127.0.0.1" });

	let formData = new FormData();
	formData.append("key", "change_me");
	let res = await fetch(`${address}/auth/login`, {
		method: "POST",
		body: formData,
	});
	const login = /** @type {{ token: string }} */ (await res.json());
	const headers = { Authorization: `Bearer ${login.token}` };

	formData = new FormData();
	formData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	res = await fetch(`${address}/pkg/@cuz/fuzz/1.4.8`, {
		method: "PUT",
		body: formData,
		redirect: "manual",
		headers: { ...headers },
	});
	assert.strictEqual(res.status, 303, "Expected to PUT OK");

	res = await fetch(`${address}/pkg/@cuz/fuzz/1.4.8/main/index.js`, {
		headers: {
			"accept-encoding": "br",
		},
	});
	assert.strictEqual(res.status, 200, "Expected to GET OK");
	assert.strictEqual(res.headers.get("content-encoding"), "br");
});
