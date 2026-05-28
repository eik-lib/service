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

const RE_CREATED = /"created":[0-9]+,/gi;

/** @type {import('fastify').FastifyInstance} */
let app;
/** @type {string} */
let address;
/** @type {Record<string, string>} */
let headers;
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

	const formData = new FormData();
	formData.append("key", "change_me");
	const res = await fetch(`${address}/auth/login`, {
		method: "POST",
		body: formData,
	});
	const login = /** @type {{ token: string }} */ (await res.json());
	headers = { Authorization: `Bearer ${login.token}` };
});

afterEach(() => {
	sink.clear();
});

after(async () => {
	await app.close();
});

test("img packages - no auth token on PUT - scoped", async () => {
	const formData = new FormData();
	formData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	const uploaded = await fetch(`${address}/img/@cuz/fuzz/1.4.8`, {
		method: "PUT",
		body: formData,
		redirect: "manual",
	});

	assert.strictEqual(
		uploaded.status,
		401,
		"on PUT of package, server should respond with a 401 Unauthorized",
	);
});

test("img packages - no auth token on PUT - non scoped", async () => {
	const formData = new FormData();
	formData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	const uploaded = await fetch(`${address}/img/fuzz/1.4.8`, {
		method: "PUT",
		body: formData,
		redirect: "manual",
	});

	assert.strictEqual(
		uploaded.status,
		401,
		"on PUT of package, server should respond with a 401 Unauthorized",
	);
});

test("img packages - put pkg -> get file - scoped successfully uploaded", async (t) => {
	const formData = new FormData();
	formData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	const uploaded = await fetch(`${address}/img/@cuz/fuzz/1.4.8`, {
		method: "PUT",
		body: formData,
		redirect: "manual",
		headers: { ...headers },
	});

	assert.strictEqual(
		uploaded.status,
		303,
		"on PUT of package, server should respond with a 303 redirect",
	);
	assert.strictEqual(
		uploaded.headers.get("location"),
		`/img/@cuz/fuzz/1.4.8`,
		"on PUT of package, server should respond with a location header",
	);

	// GET file from server
	const downloaded = await fetch(
		`${address}/img/@cuz/fuzz/1.4.8/main/index.js`,
		{
			method: "GET",
		},
	);
	const downloadedResponse = await downloaded.text();

	assert.strictEqual(
		downloaded.status,
		200,
		"on GET of file, server should respond with 200 ok",
	);
	t.assert.snapshot(downloadedResponse);
});

test("img packages - put pkg -> get file - non scoped successfully uploaded", async (t) => {
	const formData = new FormData();
	formData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	const uploaded = await fetch(`${address}/img/fuzz/8.4.1`, {
		method: "PUT",
		body: formData,
		headers: { ...headers },
		redirect: "manual",
	});

	assert.strictEqual(
		uploaded.status,
		303,
		"on PUT of package, server should respond with a 303 redirect",
	);
	assert.strictEqual(
		uploaded.headers.get("location"),
		`/img/fuzz/8.4.1`,
		"on PUT of package, server should respond with a location header",
	);

	// GET file from server
	const downloaded = await fetch(`${address}/img/fuzz/8.4.1/main/index.js`, {
		method: "GET",
	});
	const downloadedResponse = await downloaded.text();

	assert.strictEqual(
		downloaded.status,
		200,
		"on GET of file, server should respond with 200 ok",
	);
	t.assert.snapshot(downloadedResponse);
});

test("img packages - get package overview - scoped", async (t) => {
	const formData = new FormData();
	formData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	const uploaded = await fetch(`${address}/img/@cuz/fuzz/8.4.1/`, {
		method: "PUT",
		body: formData,
		headers: { ...headers },
		redirect: "manual",
	});

	assert.strictEqual(
		uploaded.status,
		303,
		"on PUT of package, server should respond with a 303 redirect",
	);
	assert.strictEqual(
		uploaded.headers.get("location"),
		`/img/@cuz/fuzz/8.4.1`,
		"on PUT of package, server should respond with a location header",
	);

	// GET package overview from server
	const downloaded = await fetch(`${address}/img/@cuz/fuzz/8.4.1/`, {
		method: "GET",
	});
	const downloadedResponse = await downloaded.json();

	assert.strictEqual(
		downloaded.status,
		200,
		"on GET, server should respond with 200 ok",
	);
	t.assert.snapshot(
		JSON.stringify(downloadedResponse).replace(RE_CREATED, '"created": -1,'),
	);
});

test("img packages - get package overview - non scoped", async (t) => {
	const formData = new FormData();
	formData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	const uploaded = await fetch(`${address}/img/fuzz/8.4.1/`, {
		method: "PUT",
		body: formData,
		headers: { ...headers },
		redirect: "manual",
	});

	assert.strictEqual(
		uploaded.status,
		303,
		"on PUT of package, server should respond with a 303 redirect",
	);
	assert.strictEqual(
		uploaded.headers.get("location"),
		`/img/fuzz/8.4.1`,
		"on PUT of package, server should respond with a location header",
	);

	// GET package overview from server
	const downloaded = await fetch(`${address}/img/fuzz/8.4.1/`, {
		method: "GET",
	});
	const downloadedResponse = await downloaded.json();

	assert.strictEqual(
		downloaded.status,
		200,
		"on GET, server should respond with 200 ok",
	);
	t.assert.snapshot(
		JSON.stringify(downloadedResponse).replace(RE_CREATED, '"created": -1,'),
	);
});

test("img packages - get package versions - scoped", async (t) => {
	// PUT files on server

	const formDataA = new FormData();
	formDataA.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));
	await fetch(`${address}/img/@cuz/fuzz/7.3.2/`, {
		method: "PUT",
		body: formDataA,
		headers: { ...headers },
		redirect: "manual",
	});

	const formDataB = new FormData();
	formDataB.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));
	await fetch(`${address}/img/@cuz/fuzz/8.4.1/`, {
		method: "PUT",
		body: formDataB,
		headers: { ...headers },
		redirect: "manual",
	});

	const formDataC = new FormData();
	formDataC.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));
	await fetch(`${address}/img/@cuz/fuzz/8.5.1/`, {
		method: "PUT",
		body: formDataC,
		headers: { ...headers },
		redirect: "manual",
	});

	// GET version overview from server
	const downloaded = await fetch(`${address}/img/@cuz/fuzz/`, {
		method: "GET",
	});
	const downloadedResponse = await downloaded.json();

	assert.strictEqual(
		downloaded.status,
		200,
		"on GET, server should respond with 200 ok",
	);
	t.assert.snapshot(
		JSON.stringify(downloadedResponse).replace(RE_CREATED, '"created": -1,'),
	);
});

test("img packages - get package versions - non scoped", async (t) => {
	// PUT files on server

	const formDataA = new FormData();
	formDataA.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));
	await fetch(`${address}/img/fuzz/7.3.2/`, {
		method: "PUT",
		body: formDataA,
		headers: { ...headers },
		redirect: "manual",
	});

	const formDataB = new FormData();
	formDataB.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));
	await fetch(`${address}/img/fuzz/8.4.1/`, {
		method: "PUT",
		body: formDataB,
		headers: { ...headers },
		redirect: "manual",
	});

	const formDataC = new FormData();
	formDataC.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));
	await fetch(`${address}/img/fuzz/8.5.1/`, {
		method: "PUT",
		body: formDataC,
		headers: { ...headers },
		redirect: "manual",
	});

	// GET version overview from server
	const downloaded = await fetch(`${address}/img/fuzz/`, {
		method: "GET",
	});
	const downloadedResponse = await downloaded.json();

	assert.strictEqual(
		downloaded.status,
		200,
		"on GET, server should respond with 200 ok",
	);
	t.assert.snapshot(
		JSON.stringify(downloadedResponse).replace(RE_CREATED, '"created": -1,'),
	);
});
