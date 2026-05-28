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
const FIXTURE_MAP_B = path.resolve(
	__dirname,
	"..",
	"fixtures",
	"import-map-b.json",
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

test("alias map - no auth token on PUT - scoped", async () => {
	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/map/@cuz/fuzz/v8`, {
		method: "PUT",
		body: aliasFormData,
	});

	assert.strictEqual(
		alias.status,
		401,
		"on PUT of alias, server should respond with a 401 Unauthorized",
	);
});

test("alias map - no auth token on PUT - non scoped", async () => {
	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/map/fuzz/v8`, {
		method: "PUT",
		body: aliasFormData,
	});

	assert.strictEqual(
		alias.status,
		401,
		"on PUT of alias, server should respond with a 401 Unauthorized",
	);
});

test("alias map - no auth token on POST - scoped", async () => {
	// POST alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/map/@cuz/fuzz/v8`, {
		method: "POST",
		body: aliasFormData,
	});

	assert.strictEqual(
		alias.status,
		401,
		"on POST of alias, server should respond with a 401 Unauthorized",
	);
});

test("alias map - no auth token on POST - non scoped", async () => {
	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/map/fuzz/v8`, {
		method: "POST",
		body: aliasFormData,
	});

	assert.strictEqual(
		alias.status,
		401,
		"on POST of alias, server should respond with a 401 Unauthorized",
	);
});

test("alias map - no auth token on DELETE - scoped", async () => {
	// DELETE alias on server

	const alias = await fetch(`${address}/map/@cuz/fuzz/v8`, {
		method: "DELETE",
	});

	assert.strictEqual(
		alias.status,
		401,
		"on POST of alias, server should respond with a 401 Unauthorized",
	);
});

test("alias map - no auth token on POST - non scoped (delete)", async () => {
	// PUT alias on server

	const alias = await fetch(`${address}/map/fuzz/v8`, {
		method: "DELETE",
	});

	assert.strictEqual(
		alias.status,
		401,
		"on POST of alias, server should respond with a 401 Unauthorized",
	);
});

test("alias map - put alias, then get map through alias - scoped", async (t) => {
	// PUT map on server
	const pkgFormData = new FormData();
	pkgFormData.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));

	const uploaded = await fetch(`${address}/map/@cuz/fuzz/8.4.1`, {
		method: "PUT",
		body: pkgFormData,
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
		`/map/@cuz/fuzz/8.4.1`,
		"on PUT of map, server should respond with a location header",
	);

	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/map/@cuz/fuzz/v8`, {
		method: "PUT",
		body: aliasFormData,
		headers: { ...headers },
		redirect: "manual",
	});

	assert.strictEqual(
		alias.status,
		303,
		"on PUT of alias, server should respond with a 303 redirect",
	);
	assert.strictEqual(
		alias.headers.get("location"),
		`/map/@cuz/fuzz/v8`,
		"on PUT of alias, server should respond with a location header",
	);

	// GET map through alias from server
	const redirect = await fetch(`${address}${alias.headers.get("location")}`, {
		method: "GET",
		redirect: "manual",
	});

	assert.strictEqual(
		redirect.status,
		302,
		"on GET of map through alias, server should respond with a 302 redirect",
	);
	assert.strictEqual(
		redirect.headers.get("location"),
		`/map/@cuz/fuzz/8.4.1`,
		"on GET of map through alias, server should respond with a location header",
	);

	// GET map from server
	const downloaded = await fetch(
		`${address}${redirect.headers.get("location")}`,
		{
			method: "GET",
		},
	);

	const downloadedResponse = await downloaded.json();

	assert.strictEqual(
		downloaded.status,
		200,
		"on GET of map, server should respond with 200 ok",
	);
	t.assert.snapshot(JSON.stringify(downloadedResponse));
});

test("alias map - put alias, then get map through alias - non scoped", async (t) => {
	// PUT map on server
	const pkgFormData = new FormData();
	pkgFormData.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));

	const uploaded = await fetch(`${address}/map/fuzz/8.4.1`, {
		method: "PUT",
		body: pkgFormData,
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
		`/map/fuzz/8.4.1`,
		"on PUT of map, server should respond with a location header",
	);

	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/map/fuzz/v8`, {
		method: "PUT",
		body: aliasFormData,
		headers: { ...headers },
		redirect: "manual",
	});

	assert.strictEqual(
		alias.status,
		303,
		"on PUT of alias, server should respond with a 303 redirect",
	);
	assert.strictEqual(
		alias.headers.get("location"),
		`/map/fuzz/v8`,
		"on PUT of alias, server should respond with a location header",
	);

	// GET file through alias from server
	const redirect = await fetch(`${address}${alias.headers.get("location")}`, {
		method: "GET",
		redirect: "manual",
	});

	assert.strictEqual(
		redirect.status,
		302,
		"on GET of map through alias, server should respond with a 302 redirect",
	);
	assert.strictEqual(
		redirect.headers.get("location"),
		`/map/fuzz/8.4.1`,
		"on GET of map through alias, server should respond with a location header",
	);

	// GET file from server
	const downloaded = await fetch(
		`${address}${redirect.headers.get("location")}`,
		{
			method: "GET",
		},
	);

	const downloadedResponse = await downloaded.json();

	assert.strictEqual(
		downloaded.status,
		200,
		"on GET of map, server should respond with 200 ok",
	);
	t.assert.snapshot(JSON.stringify(downloadedResponse));
});

test("alias map - put alias, then update alias, then get map through alias - scoped", async () => {
	// PUT maps on server
	const pkgFormDataA = new FormData();
	pkgFormDataA.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));
	await fetch(`${address}/map/@cuz/fuzz/8.4.1`, {
		method: "PUT",
		body: pkgFormDataA,
		headers: { ...headers },
		redirect: "manual",
	});

	const pkgFormDataB = new FormData();
	pkgFormDataB.append("map", new Blob([fs.readFileSync(FIXTURE_MAP_B)]));
	await fetch(`${address}/map/@cuz/fuzz/8.8.9`, {
		method: "PUT",
		body: pkgFormDataB,
		headers: { ...headers },
		redirect: "manual",
	});

	// PUT alias on server
	const aliasFormDataA = new FormData();
	aliasFormDataA.append("version", "8.4.1");

	const aliasA = await fetch(`${address}/map/@cuz/fuzz/v8`, {
		method: "PUT",
		body: aliasFormDataA,
		headers: { ...headers },
	});

	const aliasResponseA = /** @type {{ imports: { fuzz: string }}} */ (
		await aliasA.json()
	);

	assert.strictEqual(
		aliasResponseA.imports.fuzz,
		"http://localhost:4001/finn/pkg/fuzz/v8",
		'on PUT of alias, alias should redirect to set "version"',
	);

	// POST alias on server
	const aliasFormDataB = new FormData();
	aliasFormDataB.append("version", "8.8.9");

	const aliasB = await fetch(`${address}/map/@cuz/fuzz/v8`, {
		method: "POST",
		body: aliasFormDataB,
		headers: { ...headers },
	});

	const aliasResponseB = /** @type {{ imports: { fuzz: string }}} */ (
		await aliasB.json()
	);

	assert.strictEqual(
		aliasResponseB.imports.fuzz,
		"http://localhost:4001/finn/pkg/fuzz/v9",
		'on POST of alias, alias should redirect to set "version"',
	);
});

test("alias map - put alias, then update alias, then get map through alias - non scoped", async () => {
	// PUT maps on server
	const pkgFormDataA = new FormData();
	pkgFormDataA.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));
	await fetch(`${address}/map/fuzz/8.4.1`, {
		method: "PUT",
		body: pkgFormDataA,
		headers: { ...headers },
		redirect: "manual",
	});

	const pkgFormDataB = new FormData();
	pkgFormDataB.append("map", new Blob([fs.readFileSync(FIXTURE_MAP_B)]));
	await fetch(`${address}/map/fuzz/8.8.9`, {
		method: "PUT",
		body: pkgFormDataB,
		headers: { ...headers },
		redirect: "manual",
	});

	// PUT alias on server
	const aliasFormDataA = new FormData();
	aliasFormDataA.append("version", "8.4.1");

	const aliasA = await fetch(`${address}/map/fuzz/v8`, {
		method: "PUT",
		body: aliasFormDataA,
		headers: { ...headers },
	});

	const aliasResponseA = /** @type {{ imports: { fuzz: string }}} */ (
		await aliasA.json()
	);

	assert.strictEqual(
		aliasResponseA.imports.fuzz,
		"http://localhost:4001/finn/pkg/fuzz/v8",
		'on PUT of alias, alias should redirect to set "version"',
	);

	// POST alias on server
	const aliasFormDataB = new FormData();
	aliasFormDataB.append("version", "8.8.9");

	const aliasB = await fetch(`${address}/map/fuzz/v8`, {
		method: "POST",
		body: aliasFormDataB,
		headers: { ...headers },
	});

	const aliasResponseB = /** @type {{ imports: { fuzz: string }}} */ (
		await aliasB.json()
	);

	assert.strictEqual(
		aliasResponseB.imports.fuzz,
		"http://localhost:4001/finn/pkg/fuzz/v9",
		'on POST of alias, alias should redirect to set "version"',
	);
});

test("alias map - put alias, then delete alias, then get map through alias - scoped", async () => {
	// PUT map on server
	const pkgFormData = new FormData();
	pkgFormData.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));

	const uploaded = await fetch(`${address}/map/@cuz/fuzz/8.4.1`, {
		method: "PUT",
		body: pkgFormData,
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
		`/map/@cuz/fuzz/8.4.1`,
		"on PUT of map, server should respond with a location header",
	);

	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/map/@cuz/fuzz/v8`, {
		method: "PUT",
		body: aliasFormData,
		headers: { ...headers },
	});

	const aliasResponse = /** @type {{ imports: { fuzz: string }}} */ (
		await alias.json()
	);

	assert.strictEqual(
		aliasResponse.imports.fuzz,
		"http://localhost:4001/finn/pkg/fuzz/v8",
		'on PUT of alias, alias should redirect to set "version"',
	);

	// DELETE alias on server
	const deleted = await fetch(`${address}/map/@cuz/fuzz/v8`, {
		method: "DELETE",
		headers,
	});

	assert.strictEqual(
		deleted.status,
		204,
		"on DELETE of alias, server should respond with a 204 Deleted",
	);

	// GET map through alias from server
	const errored = await fetch(`${address}/map/@cuz/fuzz/v8`, {
		method: "GET",
		redirect: "manual",
	});

	assert.strictEqual(
		errored.status,
		404,
		"on GET of map through deleted alias, server should respond with a 404 Not Found",
	);
});

test("alias map - put alias, then delete alias, then get map through alias - non scoped", async () => {
	// PUT map on server
	const pkgFormData = new FormData();
	pkgFormData.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));

	const uploaded = await fetch(`${address}/map/fuzz/8.4.1`, {
		method: "PUT",
		body: pkgFormData,
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
		`/map/fuzz/8.4.1`,
		"on PUT of map, server should respond with a location header",
	);

	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/map/fuzz/v8`, {
		method: "PUT",
		body: aliasFormData,
		headers: { ...headers },
	});

	const aliasResponse = /** @type {{ imports: { fuzz: string }}} */ (
		await alias.json()
	);

	assert.strictEqual(
		aliasResponse.imports.fuzz,
		"http://localhost:4001/finn/pkg/fuzz/v8",
		'on PUT of alias, alias should redirect to set "version"',
	);

	// DELETE alias on server
	const deleted = await fetch(`${address}/map/fuzz/v8`, {
		method: "DELETE",
		headers,
	});

	assert.strictEqual(
		deleted.status,
		204,
		"on DELETE of alias, server should respond with a 204 Deleted",
	);

	// GET map through alias from server
	const errored = await fetch(`${address}/map/fuzz/v8`, {
		method: "GET",
		redirect: "manual",
	});

	assert.strictEqual(
		errored.status,
		404,
		"on GET of map through deleted alias, server should respond with a 404 Not Found",
	);
});
