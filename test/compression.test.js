import FormData from "form-data";
import fastify from "fastify";
import fetch from "node-fetch";
import path from "path";
import tap from "tap";
import url from "url";
import fs from "fs";

import Sink from "./utils/sink.js";
import Server from "../lib/main.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const FIXTURE_PKG = path.resolve(__dirname, "..", "fixtures", "archive.tgz");

// Ignore the timestamp for "created" field in the snapshots
tap.cleanSnapshot = (s) => {
	const regex = /"created": [0-9]+,/gi;
	return s.replace(regex, '"created": -1,');
};

/** @type {import('fastify').FastifyInstance} */
let app;
/** @type {string} */
let address;
/** @type {Record<string, string>} */
let headers;
/** @type {Sink} */
let sink;

tap.teardown(async () => {
	sink.clear();
	await app.close();
});

tap.test("compression - assets should have content-encoding: br", async (t) => {
	sink = new Sink();
	const service = new Server({ sink });

	app = fastify({
		ignoreTrailingSlash: true,
		forceCloseConnections: true,
	});

	await app.register(service.api());

	address = await app.listen({ port: 0, host: "127.0.0.1" });

	let formData = new FormData();
	formData.append("key", "change_me");
	let res = await fetch(`${address}/auth/login`, {
		method: "POST",
		body: formData,
		headers: formData.getHeaders(),
	});
	const login = /** @type {{ token: string }} */ (await res.json());
	headers = { Authorization: `Bearer ${login.token}` };

	formData = new FormData();
	formData.append("package", fs.createReadStream(FIXTURE_PKG));

	// PUT files on server
	res = await fetch(`${address}/pkg/@cuz/fuzz/1.4.8`, {
		method: "PUT",
		body: formData,
		redirect: "manual",
		headers: { ...headers, ...formData.getHeaders() },
	});
	t.equal(res.status, 303, "Expected to PUT OK");

	res = await fetch(`${address}/pkg/@cuz/fuzz/1.4.8/main/index.js`, {
		headers: {
			"accept-encoding": "br",
		},
	});
	t.equal(res.status, 200, "Expected to GET OK");
	t.equal(res.headers.get("content-encoding"), "br");
});
