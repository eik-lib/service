import fastify from "fastify";
import path from "path";
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import url from "url";
import fs from "fs";

import Sink from "./utils/sink.js";
import Server from "../lib/main.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const FIXTURE_MAP = path.resolve(
	__dirname,
	"..",
	"fixtures",
	"import-map.json",
);

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

test("import-map - no auth token on PUT - scoped", async () => {
	const formData = new FormData();
	formData.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));

	// PUT map on server
	const uploaded = await fetch(`${address}/map/@cuz/buzz/4.2.2`, {
		method: "PUT",
		body: formData,
		redirect: "manual",
	});

	assert.strictEqual(
		uploaded.status,
		401,
		"on PUT of map, server should respond with a 401 Unauthorized",
	);
});

test("import-map - no auth token on PUT - non scoped", async () => {
	const formData = new FormData();
	formData.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));

	// PUT map on server
	const uploaded = await fetch(`${address}/map/buzz/4.2.2`, {
		method: "PUT",
		body: formData,
		redirect: "manual",
	});

	assert.strictEqual(
		uploaded.status,
		401,
		"on PUT of map, server should respond with a 401 Unauthorized",
	);
});

test("import-map - put map -> get map - scoped successfully uploaded", async (t) => {
	const formData = new FormData();
	formData.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));

	// PUT map on server
	const uploaded = await fetch(`${address}/map/@cuz/buzz/4.2.2`, {
		method: "PUT",
		body: formData,
		headers: { ...headers },
		redirect: "manual",
	});

	assert.strictEqual(
		uploaded.status,
		303,
		"on PUT of map, server should respond with a 303 redirect",
	);
	assert.strictEqual(
		uploaded.headers.get("location"),
		`/map/@cuz/buzz/4.2.2`,
		"on PUT of map, server should respond with a location header",
	);

	// GET map from server
	const downloaded = await fetch(`${address}/map/@cuz/buzz/4.2.2`, {
		method: "GET",
	});

	const downloadedResponse = await downloaded.json();

	assert.strictEqual(
		downloaded.status,
		200,
		"on GET of map, server should respond with 200 ok",
	);
	t.assert.snapshot(JSON.stringify(downloadedResponse));
});

test("import-map - put map -> get map - non scoped successfully uploaded", async (t) => {
	const formData = new FormData();
	formData.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));

	// PUT map on server
	const uploaded = await fetch(`${address}/map/buzz/4.2.2`, {
		method: "PUT",
		body: formData,
		headers: { ...headers },
		redirect: "manual",
	});

	assert.strictEqual(
		uploaded.status,
		303,
		"on PUT of map, server should respond with a 303 redirect",
	);
	assert.strictEqual(
		uploaded.headers.get("location"),
		`/map/buzz/4.2.2`,
		"on PUT of map, server should respond with a location header",
	);

	// GET map from server
	const downloaded = await fetch(`${address}/map/buzz/4.2.2`, {
		method: "GET",
	});

	const downloadedResponse = await downloaded.json();

	assert.strictEqual(
		downloaded.status,
		200,
		"on GET of map, server should respond with 200 ok",
	);
	t.assert.snapshot(JSON.stringify(downloadedResponse));
});

test("import-map - get map versions - scoped", async (t) => {
	// PUT map on server

	const formDataA = new FormData();
	formDataA.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));
	await fetch(`${address}/map/@cuz/buzz/4.2.2`, {
		method: "PUT",
		body: formDataA,
		headers: { ...headers },
		redirect: "manual",
	});

	const formDataB = new FormData();
	formDataB.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));
	await fetch(`${address}/map/@cuz/buzz/5.2.2`, {
		method: "PUT",
		body: formDataB,
		headers: { ...headers },
		redirect: "manual",
	});

	const formDataC = new FormData();
	formDataC.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));
	await fetch(`${address}/map/@cuz/buzz/4.9.2`, {
		method: "PUT",
		body: formDataC,
		headers: { ...headers },
		redirect: "manual",
	});

	// GET map from server
	const downloaded = await fetch(`${address}/map/@cuz/buzz`, {
		method: "GET",
	});

	const downloadedResponse = await downloaded.json();

	assert.strictEqual(
		downloaded.status,
		200,
		"on GET of map versions, server should respond with 200 ok",
	);
	t.assert.snapshot(JSON.stringify(downloadedResponse));
});

test("import-map - get map versions - non scoped", async (t) => {
	// PUT map on server

	const formDataA = new FormData();
	formDataA.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));
	await fetch(`${address}/map/buzz/4.2.2`, {
		method: "PUT",
		body: formDataA,
		headers: { ...headers },
		redirect: "manual",
	});

	const formDataB = new FormData();
	formDataB.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));
	await fetch(`${address}/map/buzz/5.2.2`, {
		method: "PUT",
		body: formDataB,
		headers: { ...headers },
		redirect: "manual",
	});

	const formDataC = new FormData();
	formDataC.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));
	await fetch(`${address}/map/buzz/4.9.2`, {
		method: "PUT",
		body: formDataC,
		headers: { ...headers },
		redirect: "manual",
	});

	// GET map from server
	const downloaded = await fetch(`${address}/map/buzz`, {
		method: "GET",
	});

	const downloadedResponse = await downloaded.json();

	assert.strictEqual(
		downloaded.status,
		200,
		"on GET of map versions, server should respond with 200 ok",
	);
	t.assert.snapshot(JSON.stringify(downloadedResponse));
});
