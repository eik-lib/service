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

test("alias package - no auth token on PUT - scoped", async () => {
	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
		method: "PUT",
		body: aliasFormData,
	});

	assert.strictEqual(
		alias.status,
		401,
		"on PUT of alias, server should respond with a 401 Unauthorized",
	);
});

test("alias package - no auth token on PUT - non scoped", async () => {
	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/pkg/fuzz/v8`, {
		method: "PUT",
		body: aliasFormData,
	});

	assert.strictEqual(
		alias.status,
		401,
		"on PUT of alias, server should respond with a 401 Unauthorized",
	);
});

test("alias package - no auth token on POST - scoped", async () => {
	// POST alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
		method: "POST",
		body: aliasFormData,
	});

	assert.strictEqual(
		alias.status,
		401,
		"on POST of alias, server should respond with a 401 Unauthorized",
	);
});

test("alias package - no auth token on POST - non scoped", async () => {
	// POST alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/pkg/fuzz/v8`, {
		method: "POST",
		body: aliasFormData,
	});

	assert.strictEqual(
		alias.status,
		401,
		"on POST of alias, server should respond with a 401 Unauthorized",
	);
});

test("alias package - no auth token on DELETE - scoped", async () => {
	// DELETE alias on server
	const alias = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
		method: "DELETE",
	});

	assert.strictEqual(
		alias.status,
		401,
		"on DELETE of alias, server should respond with a 401 Unauthorized",
	);
});

test("alias package - no auth token on DELETE - non scoped", async () => {
	// DELETE alias on server
	const alias = await fetch(`${address}/pkg/fuzz/v8`, {
		method: "DELETE",
	});

	assert.strictEqual(
		alias.status,
		401,
		"on DELETE of alias, server should respond with a 401 Unauthorized",
	);
});

test("alias package - put alias, then get file overview through alias - scoped", async (t) => {
	const pkgFormData = new FormData();
	pkgFormData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	const uploaded = await fetch(`${address}/pkg/@cuz/fuzz/8.4.1`, {
		method: "PUT",
		body: pkgFormData,
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
		`/pkg/@cuz/fuzz/8.4.1`,
		"on PUT of package, server should respond with a location header",
	);

	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
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
		`/pkg/@cuz/fuzz/v8`,
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
		"on GET of file through alias, server should respond with a 302 redirect",
	);
	assert.strictEqual(
		redirect.headers.get("location"),
		`/pkg/@cuz/fuzz/8.4.1`,
		"on GET of file through alias, server should respond with a location header",
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
		"on GET of file, server should respond with 200 ok",
	);
	t.assert.snapshot(
		JSON.stringify(downloadedResponse).replace(RE_CREATED, '"created": -1,'),
	);
});

test("alias package - put alias, then get file overview through alias - non scoped", async (t) => {
	const pkgFormData = new FormData();
	pkgFormData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	const uploaded = await fetch(`${address}/pkg/fuzz/8.4.1`, {
		method: "PUT",
		body: pkgFormData,
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
		`/pkg/fuzz/8.4.1`,
		"on PUT of package, server should respond with a location header",
	);

	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/pkg/fuzz/v8`, {
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
		`/pkg/fuzz/v8`,
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
		"on GET of file through alias, server should respond with a 302 redirect",
	);
	assert.strictEqual(
		redirect.headers.get("location"),
		`/pkg/fuzz/8.4.1`,
		"on GET of file through alias, server should respond with a location header",
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
		"on GET of file, server should respond with 200 ok",
	);
	t.assert.snapshot(
		JSON.stringify(downloadedResponse).replace(RE_CREATED, '"created": -1,'),
	);
});

test("alias package - put alias, then get file through alias - scoped", async (t) => {
	const pkgFormData = new FormData();
	pkgFormData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	const uploaded = await fetch(`${address}/pkg/@cuz/fuzz/8.4.1`, {
		method: "PUT",
		body: pkgFormData,
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
		`/pkg/@cuz/fuzz/8.4.1`,
		"on PUT of package, server should respond with a location header",
	);

	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
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
		`/pkg/@cuz/fuzz/v8`,
		"on PUT of alias, server should respond with a location header",
	);

	// GET file through alias from server
	const redirect = await fetch(`${address}/pkg/@cuz/fuzz/v8/main/index.js`, {
		method: "GET",
		redirect: "manual",
	});

	assert.strictEqual(
		redirect.status,
		302,
		"on GET of file through alias, server should respond with a 302 redirect",
	);
	assert.strictEqual(
		redirect.headers.get("location"),
		`/pkg/@cuz/fuzz/8.4.1/main/index.js`,
		"on GET of file through alias, server should respond with a location header",
	);

	// GET file from server
	const downloaded = await fetch(
		`${address}${redirect.headers.get("location")}`,
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

	// GET file through stale-while-revalidate alias from server
	const staleWhileRevalidate = await fetch(
		`${address}${(alias.headers.get("location") || "").replace("v8", "~8")}/main/index.js`,
		{
			method: "GET",
			redirect: "manual",
		},
	);

	const staleWhileRevalidateResponse = await staleWhileRevalidate.text();
	assert.strictEqual(
		staleWhileRevalidate.status,
		200,
		"on GET of stale-while-revalidate alias, server should respond with 200 ok",
	);
	assert.match(
		staleWhileRevalidate.headers.get("cache-control") || "",
		/stale-while-revalidate/,
		"Expected stale-while-revalidate directive in cache-control header",
	);
	t.assert.snapshot(staleWhileRevalidateResponse);
});

test("alias package - put alias, then get file through alias - non scoped", async (t) => {
	const pkgFormData = new FormData();
	pkgFormData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	const uploaded = await fetch(`${address}/pkg/fuzz/8.4.1`, {
		method: "PUT",
		body: pkgFormData,
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
		`/pkg/fuzz/8.4.1`,
		"on PUT of package, server should respond with a location header",
	);

	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/pkg/fuzz/v8`, {
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
		`/pkg/fuzz/v8`,
		"on PUT of alias, server should respond with a location header",
	);

	// GET file through alias from server
	const redirect = await fetch(`${address}/pkg/fuzz/v8/main/index.js`, {
		method: "GET",
		redirect: "manual",
	});

	assert.strictEqual(
		redirect.status,
		302,
		"on GET of file through alias, server should respond with a 302 redirect",
	);
	assert.strictEqual(
		redirect.headers.get("location"),
		`/pkg/fuzz/8.4.1/main/index.js`,
		"on GET of file through alias, server should respond with a location header",
	);

	// GET file from server
	const downloaded = await fetch(
		`${address}${redirect.headers.get("location")}`,
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

	// GET file through stale-while-revalidate alias from server
	const staleWhileRevalidate = await fetch(
		`${address}${(alias.headers.get("location") || "").replace("v8", "~8")}/main/index.js`,
		{
			method: "GET",
			redirect: "manual",
		},
	);

	const staleWhileRevalidateResponse = await staleWhileRevalidate.text();
	assert.strictEqual(
		staleWhileRevalidate.status,
		200,
		"on GET of stale-while-revalidate alias, server should respond with 200 ok",
	);
	assert.match(
		staleWhileRevalidate.headers.get("cache-control") || "",
		/stale-while-revalidate/,
		"Expected stale-while-revalidate directive in cache-control header",
	);
	t.assert.snapshot(staleWhileRevalidateResponse);
});

test("alias package - put alias, then update alias, then get file through alias - scoped", async () => {
	// PUT packages on server
	const pkgFormDataA = new FormData();
	pkgFormDataA.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));
	await fetch(`${address}/pkg/@cuz/fuzz/8.4.1`, {
		method: "PUT",
		body: pkgFormDataA,
		headers: { ...headers },
		redirect: "manual",
	});

	const pkgFormDataB = new FormData();
	pkgFormDataB.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));
	await fetch(`${address}/pkg/@cuz/fuzz/8.8.9`, {
		method: "PUT",
		body: pkgFormDataB,
		headers: { ...headers },
		redirect: "manual",
	});

	// PUT alias on server
	const aliasFormDataA = new FormData();
	aliasFormDataA.append("version", "8.4.1");

	const aliasA = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
		method: "PUT",
		body: aliasFormDataA,
		headers: { ...headers },
	});

	const aliasResponseA = /** @type {{ version: string; name: String; }} */ (
		await aliasA.json()
	);

	assert.strictEqual(
		aliasResponseA.version,
		"8.4.1",
		'on PUT of alias, alias should redirect to set "version"',
	);
	assert.strictEqual(
		aliasResponseA.name,
		"@cuz/fuzz",
		'on PUT of alias, alias should redirect to set "name"',
	);

	// POST alias on server
	const aliasFormDataB = new FormData();
	aliasFormDataB.append("version", "8.8.9");

	const aliasB = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
		method: "POST",
		body: aliasFormDataB,
		headers: { ...headers },
	});

	const aliasResponseB = /** @type {{ version: string; name: String; }} */ (
		await aliasB.json()
	);

	assert.strictEqual(
		aliasResponseB.version,
		"8.8.9",
		'on POST of alias, alias should redirect to updated "version"',
	);
	assert.strictEqual(
		aliasResponseB.name,
		"@cuz/fuzz",
		'on POST of alias, alias should redirect to set "name"',
	);
});

test("alias package - put alias, then update alias, then get file through alias - non scoped", async () => {
	// PUT packages on server
	const pkgFormDataA = new FormData();
	pkgFormDataA.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));
	await fetch(`${address}/pkg/fuzz/8.4.1`, {
		method: "PUT",
		body: pkgFormDataA,
		headers: { ...headers },
		redirect: "manual",
	});

	const pkgFormDataB = new FormData();
	pkgFormDataB.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));
	await fetch(`${address}/pkg/fuzz/8.8.9`, {
		method: "PUT",
		body: pkgFormDataB,
		headers: { ...headers },
		redirect: "manual",
	});

	// PUT alias on server
	const aliasFormDataA = new FormData();
	aliasFormDataA.append("version", "8.4.1");

	const aliasA = await fetch(`${address}/pkg/fuzz/v8`, {
		method: "PUT",
		body: aliasFormDataA,
		headers: { ...headers },
	});

	const aliasResponseA = /** @type {{ version: string; name: String; }} */ (
		await aliasA.json()
	);

	assert.strictEqual(
		aliasResponseA.version,
		"8.4.1",
		'on PUT of alias, alias should redirect to set "version"',
	);
	assert.strictEqual(
		aliasResponseA.name,
		"fuzz",
		'on PUT of alias, alias should redirect to set "name"',
	);

	// POST alias on server
	const aliasFormDataB = new FormData();
	aliasFormDataB.append("version", "8.8.9");

	const aliasB = await fetch(`${address}/pkg/fuzz/v8`, {
		method: "POST",
		body: aliasFormDataB,
		headers: { ...headers },
	});

	const aliasResponseB = /** @type {{ version: string; name: String; }} */ (
		await aliasB.json()
	);

	assert.strictEqual(
		aliasResponseB.version,
		"8.8.9",
		'on POST of alias, alias should redirect to updated "version"',
	);
	assert.strictEqual(
		aliasResponseB.name,
		"fuzz",
		'on POST of alias, alias should redirect to set "name"',
	);
});

test("alias package - put alias, then delete alias, then get file through alias - scoped", async () => {
	const pkgFormData = new FormData();
	pkgFormData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	const uploaded = await fetch(`${address}/pkg/@cuz/fuzz/8.4.1`, {
		method: "PUT",
		body: pkgFormData,
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
		`/pkg/@cuz/fuzz/8.4.1`,
		"on PUT of package, server should respond with a location header",
	);

	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
		method: "PUT",
		body: aliasFormData,
		headers: { ...headers },
	});

	const aliasResponse = /** @type {{ version: string; name: String; }} */ (
		await alias.json()
	);

	assert.strictEqual(
		aliasResponse.version,
		"8.4.1",
		'on PUT of alias, alias should redirect to set "version"',
	);
	assert.strictEqual(
		aliasResponse.name,
		"@cuz/fuzz",
		'on PUT of alias, alias should redirect to set "name"',
	);

	// DELETE alias on server
	const deleted = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
		method: "DELETE",
		headers,
	});

	assert.strictEqual(
		deleted.status,
		204,
		"on DELETE of alias, server should respond with a 204 Deleted",
	);

	// GET file through alias from server
	const errored = await fetch(`${address}/pkg/@cuz/fuzz/v8/main/index.js`, {
		method: "GET",
		redirect: "manual",
	});

	assert.strictEqual(
		errored.status,
		404,
		"on GET of file through deleted alias, server should respond with a 404 Not Found",
	);
});

test("alias package - put alias, then delete alias, then get file through alias - non scoped", async () => {
	const pkgFormData = new FormData();
	pkgFormData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	const uploaded = await fetch(`${address}/pkg/fuzz/8.4.1`, {
		method: "PUT",
		body: pkgFormData,
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
		`/pkg/fuzz/8.4.1`,
		"on PUT of package, server should respond with a location header",
	);

	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/pkg/fuzz/v8`, {
		method: "PUT",
		body: aliasFormData,
		headers: { ...headers },
	});

	const aliasResponse = /** @type {{ version: string; name: String; }} */ (
		await alias.json()
	);

	assert.strictEqual(
		aliasResponse.version,
		"8.4.1",
		'on PUT of alias, alias should redirect to set "version"',
	);
	assert.strictEqual(
		aliasResponse.name,
		"fuzz",
		'on PUT of alias, alias should redirect to set "name"',
	);

	// DELETE alias on server
	const deleted = await fetch(`${address}/pkg/fuzz/v8`, {
		method: "DELETE",
		headers,
	});

	assert.strictEqual(
		deleted.status,
		204,
		"on DELETE of alias, server should respond with a 204 Deleted",
	);

	// GET file through alias from server
	const errored = await fetch(`${address}/pkg/fuzz/v8/main/index.js`, {
		method: "GET",
		redirect: "manual",
	});

	assert.strictEqual(
		errored.status,
		404,
		"on GET of file through deleted alias, server should respond with a 404 Not Found",
	);
});
