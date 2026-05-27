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

test("cache-control - auth post", async () => {
	const formData = new FormData();
	formData.append("key", "change_me");

	const response = await fetch(`${address}/auth/login`, {
		method: "POST",
		body: formData,
	});

	assert.strictEqual(
		response.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);
});

test("cache-control - package - non-scoped", async () => {
	const formData = new FormData();
	formData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	const uploaded = await fetch(`${address}/pkg/fuzz/1.4.8`, {
		method: "PUT",
		body: formData,
		redirect: "manual",
		headers: { ...headers },
	});
	assert.strictEqual(
		uploaded.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// GET file from server
	const fetched = await fetch(`${address}/pkg/fuzz/1.4.8/main/index.js`, {
		method: "GET",
	});
	assert.strictEqual(
		fetched.headers.get("cache-control"),
		"public, max-age=31536000, immutable",
		'should be "public, max-age=31536000, immutable"',
	);

	// GET non-existing file from server
	const nonExisting = await fetch(
		`${address}/pkg/fuzz/1.4.99999999999/main/index.js`,
		{
			method: "GET",
		},
	);
	assert.strictEqual(
		nonExisting.headers.get("cache-control"),
		"public, max-age=5",
		'should be "public, max-age=5"',
	);

	// GET package overview from server
	const overview = await fetch(`${address}/pkg/fuzz/1.4.8`, {
		method: "GET",
	});
	assert.strictEqual(
		overview.headers.get("cache-control"),
		"no-cache",
		'should be "no-cache"',
	);

	// GET package versions overview from server
	const versions = await fetch(`${address}/pkg/fuzz`, {
		method: "GET",
	});
	assert.strictEqual(
		versions.headers.get("cache-control"),
		"no-cache",
		'should be "no-cache"',
	);
});

test("cache-control - package - scoped", async () => {
	const formData = new FormData();
	formData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	const uploaded = await fetch(`${address}/pkg/@cuz/fuzz/1.4.8`, {
		method: "PUT",
		body: formData,
		redirect: "manual",
		headers: { ...headers },
	});
	assert.strictEqual(
		uploaded.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// GET file from server
	const fetched = await fetch(`${address}/pkg/@cuz/fuzz/1.4.8/main/index.js`, {
		method: "GET",
	});
	assert.strictEqual(
		fetched.headers.get("cache-control"),
		"public, max-age=31536000, immutable",
		'should be "public, max-age=31536000, immutable"',
	);

	// GET non-existing file from server
	const nonExisting = await fetch(
		`${address}/pkg/@cuz/fuzz/1.4.99999999999/main/index.js`,
		{
			method: "GET",
		},
	);
	assert.strictEqual(
		nonExisting.headers.get("cache-control"),
		"public, max-age=5",
		'should be "public, max-age=5"',
	);

	// GET package overview from server
	const overview = await fetch(`${address}/pkg/@cuz/fuzz/1.4.8`, {
		method: "GET",
	});
	assert.strictEqual(
		overview.headers.get("cache-control"),
		"no-cache",
		'should be "no-cache"',
	);

	// GET package versions overview from server
	const versions = await fetch(`${address}/pkg/@cuz/fuzz`, {
		method: "GET",
	});
	assert.strictEqual(
		versions.headers.get("cache-control"),
		"no-cache",
		'should be "no-cache"',
	);
});

test("cache-control - npm package - non-scoped", async () => {
	const formData = new FormData();
	formData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	const uploaded = await fetch(`${address}/npm/fuzz/1.4.8`, {
		method: "PUT",
		body: formData,
		redirect: "manual",
		headers: { ...headers },
	});
	assert.strictEqual(
		uploaded.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// GET file from server
	const fetched = await fetch(`${address}/npm/fuzz/1.4.8/main/index.js`, {
		method: "GET",
	});
	assert.strictEqual(
		fetched.headers.get("cache-control"),
		"public, max-age=31536000, immutable",
		'should be "public, max-age=31536000, immutable"',
	);

	// GET non-existing file from server
	const nonExisting = await fetch(
		`${address}/npm/fuzz/1.4.99999999999/main/index.js`,
		{
			method: "GET",
		},
	);
	assert.strictEqual(
		nonExisting.headers.get("cache-control"),
		"public, max-age=5",
		'should be "public, max-age=5"',
	);

	// GET package overview from server
	const overview = await fetch(`${address}/npm/fuzz/1.4.8`, {
		method: "GET",
	});
	assert.strictEqual(
		overview.headers.get("cache-control"),
		"no-cache",
		'should be "no-cache"',
	);

	// GET package versions overview from server
	const versions = await fetch(`${address}/npm/fuzz`, {
		method: "GET",
	});
	assert.strictEqual(
		versions.headers.get("cache-control"),
		"no-cache",
		'should be "no-cache"',
	);
});

test("cache-control - npm package - scoped", async () => {
	const formData = new FormData();
	formData.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	const uploaded = await fetch(`${address}/npm/@cuz/fuzz/1.4.8`, {
		method: "PUT",
		body: formData,
		redirect: "manual",
		headers: { ...headers },
	});
	assert.strictEqual(
		uploaded.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// GET file from server
	const fetched = await fetch(`${address}/npm/@cuz/fuzz/1.4.8/main/index.js`, {
		method: "GET",
	});
	assert.strictEqual(
		fetched.headers.get("cache-control"),
		"public, max-age=31536000, immutable",
		'should be "public, max-age=31536000, immutable"',
	);

	// GET non-existing file from server
	const nonExisting = await fetch(
		`${address}/pkg/@cuz/fuzz/1.4.99999999999/main/index.js`,
		{
			method: "GET",
		},
	);
	assert.strictEqual(
		nonExisting.headers.get("cache-control"),
		"public, max-age=5",
		'should be "public, max-age=5"',
	);

	// GET package overview from server
	const overview = await fetch(`${address}/npm/@cuz/fuzz/1.4.8`, {
		method: "GET",
	});
	assert.strictEqual(
		overview.headers.get("cache-control"),
		"no-cache",
		'should be "no-cache"',
	);

	// GET package versions overview from server
	const versions = await fetch(`${address}/npm/@cuz/fuzz`, {
		method: "GET",
	});
	assert.strictEqual(
		versions.headers.get("cache-control"),
		"no-cache",
		'should be "no-cache"',
	);
});

test("cache-control - map - non-scoped", async () => {
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
		uploaded.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// GET map from server
	const fetched = await fetch(`${address}/map/buzz/4.2.2`, {
		method: "GET",
	});
	assert.strictEqual(
		fetched.headers.get("cache-control"),
		"public, max-age=31536000, immutable",
		'should be "public, max-age=31536000, immutable"',
	);

	// GET non-existing file from server
	const nonExisting = await fetch(
		`${address}/map/fuzz/1.4.99999999999/main/index.js`,
		{
			method: "GET",
		},
	);
	assert.strictEqual(
		nonExisting.headers.get("cache-control"),
		"public, max-age=5",
		'should be "public, max-age=5"',
	);

	// GET map versions overview from server
	const versions = await fetch(`${address}/map/buzz`, {
		method: "GET",
	});
	assert.strictEqual(
		versions.headers.get("cache-control"),
		"no-cache",
		'should be "no-cache"',
	);
});

test("cache-control - map - scoped", async () => {
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
		uploaded.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// GET map from server
	const fetched = await fetch(`${address}/map/@cuz/buzz/4.2.2`, {
		method: "GET",
	});
	assert.strictEqual(
		fetched.headers.get("cache-control"),
		"public, max-age=31536000, immutable",
		'should be "public, max-age=31536000, immutable"',
	);

	// GET non-existing file from server
	const nonExisting = await fetch(
		`${address}/map/@cuz/fuzz/1.4.99999999999/main/index.js`,
		{
			method: "GET",
		},
	);
	assert.strictEqual(
		nonExisting.headers.get("cache-control"),
		"public, max-age=5",
		'should be "public, max-age=5"',
	);

	// GET map versions overview from server
	const versions = await fetch(`${address}/map/@cuz/buzz`, {
		method: "GET",
	});
	assert.strictEqual(
		versions.headers.get("cache-control"),
		"no-cache",
		'should be "no-cache"',
	);
});

test("cache-control - alias package - non-scoped", async () => {
	const formDataA = new FormData();
	formDataA.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	const formDataB = new FormData();
	formDataB.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	await fetch(`${address}/pkg/fuzz/8.4.1`, {
		method: "PUT",
		body: formDataA,
		redirect: "manual",
		headers: { ...headers },
	});

	// PUT files on server
	await fetch(`${address}/pkg/fuzz/8.8.1`, {
		method: "PUT",
		body: formDataB,
		redirect: "manual",
		headers: { ...headers },
	});

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
		alias.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// GET alias from server
	const redirect = await fetch(`${address}/pkg/fuzz/v8/main/index.js`, {
		method: "GET",
		redirect: "manual",
	});
	assert.strictEqual(
		redirect.headers.get("cache-control"),
		"public, max-age=1200",
		'should be "public, max-age=1200"',
	);

	// POST alias on server
	const aliasFormDataB = new FormData();
	aliasFormDataB.append("version", "8.8.1");

	const updated = await fetch(`${address}/pkg/fuzz/v8`, {
		method: "POST",
		body: aliasFormDataB,
		headers: { ...headers },
		redirect: "manual",
	});
	assert.strictEqual(
		updated.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// DELETE alias on server
	const deleted = await fetch(`${address}/pkg/fuzz/v8`, {
		method: "DELETE",
		headers,
	});
	assert.strictEqual(
		deleted.headers.get("cache-control"),
		"no-store",
		'should be "no-cache"',
	);
});

test("cache-control - alias package - scoped", async () => {
	const formDataA = new FormData();
	formDataA.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	const formDataB = new FormData();
	formDataB.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	await fetch(`${address}/pkg/@cuz/fuzz/8.4.1`, {
		method: "PUT",
		body: formDataA,
		redirect: "manual",
		headers: { ...headers },
	});

	// PUT files on server
	await fetch(`${address}/pkg/@cuz/fuzz/8.8.1`, {
		method: "PUT",
		body: formDataB,
		redirect: "manual",
		headers: { ...headers },
	});

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
		alias.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// GET alias from server
	const redirect = await fetch(`${address}/pkg/@cuz/fuzz/v8/main/index.js`, {
		method: "GET",
		redirect: "manual",
	});
	assert.strictEqual(
		redirect.headers.get("cache-control"),
		"public, max-age=1200",
		'should be "public, max-age=1200"',
	);

	// POST alias on server
	const aliasFormDataB = new FormData();
	aliasFormDataB.append("version", "8.8.1");

	const updated = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
		method: "POST",
		body: aliasFormDataB,
		headers: { ...headers },
		redirect: "manual",
	});
	assert.strictEqual(
		updated.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// DELETE alias on server
	const deleted = await fetch(`${address}/pkg/@cuz/fuzz/v8`, {
		method: "DELETE",
		headers,
	});
	assert.strictEqual(
		deleted.headers.get("cache-control"),
		"no-store",
		'should be "no-cache"',
	);
});

test("cache-control - alias NPM package - non-scoped", async () => {
	const formDataA = new FormData();
	formDataA.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	const formDataB = new FormData();
	formDataB.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	await fetch(`${address}/npm/fuzz/8.4.1`, {
		method: "PUT",
		body: formDataA,
		redirect: "manual",
		headers: { ...headers },
	});

	// PUT files on server
	await fetch(`${address}/npm/fuzz/8.8.1`, {
		method: "PUT",
		body: formDataB,
		redirect: "manual",
		headers: { ...headers },
	});

	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/npm/fuzz/v8`, {
		method: "PUT",
		body: aliasFormData,
		headers: { ...headers },
		redirect: "manual",
	});
	assert.strictEqual(
		alias.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// GET alias from server
	const redirect = await fetch(`${address}/npm/fuzz/v8/main/index.js`, {
		method: "GET",
		redirect: "manual",
	});
	assert.strictEqual(
		redirect.headers.get("cache-control"),
		"public, max-age=1200",
		'should be "public, max-age=1200"',
	);

	// POST alias on server
	const aliasFormDataB = new FormData();
	aliasFormDataB.append("version", "8.8.1");

	const updated = await fetch(`${address}/npm/fuzz/v8`, {
		method: "POST",
		body: aliasFormDataB,
		headers: { ...headers },
		redirect: "manual",
	});
	assert.strictEqual(
		updated.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// DELETE alias on server
	const deleted = await fetch(`${address}/npm/fuzz/v8`, {
		method: "DELETE",
		headers,
	});
	assert.strictEqual(
		deleted.headers.get("cache-control"),
		"no-store",
		'should be "no-cache"',
	);
});

test("cache-control - alias NPM package - scoped", async () => {
	const formDataA = new FormData();
	formDataA.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	const formDataB = new FormData();
	formDataB.append("package", new Blob([fs.readFileSync(FIXTURE_PKG)]));

	// PUT files on server
	await fetch(`${address}/npm/@cuz/fuzz/8.4.1`, {
		method: "PUT",
		body: formDataA,
		redirect: "manual",
		headers: { ...headers },
	});

	// PUT files on server
	await fetch(`${address}/npm/@cuz/fuzz/8.8.1`, {
		method: "PUT",
		body: formDataB,
		redirect: "manual",
		headers: { ...headers },
	});

	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "8.4.1");

	const alias = await fetch(`${address}/npm/@cuz/fuzz/v8`, {
		method: "PUT",
		body: aliasFormData,
		headers: { ...headers },
		redirect: "manual",
	});
	assert.strictEqual(
		alias.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// GET alias from server
	const redirect = await fetch(`${address}/npm/@cuz/fuzz/v8/main/index.js`, {
		method: "GET",
		redirect: "manual",
	});
	assert.strictEqual(
		redirect.headers.get("cache-control"),
		"public, max-age=1200",
		'should be "public, max-age=1200"',
	);

	// POST alias on server
	const aliasFormDataB = new FormData();
	aliasFormDataB.append("version", "8.8.1");

	const updated = await fetch(`${address}/npm/@cuz/fuzz/v8`, {
		method: "POST",
		body: aliasFormDataB,
		headers: { ...headers },
		redirect: "manual",
	});
	assert.strictEqual(
		updated.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// DELETE alias on server
	const deleted = await fetch(`${address}/npm/@cuz/fuzz/v8`, {
		method: "DELETE",
		headers,
	});
	assert.strictEqual(
		deleted.headers.get("cache-control"),
		"no-store",
		'should be "no-cache"',
	);
});

test("cache-control - alias map - non-scoped", async () => {
	const formDataA = new FormData();
	formDataA.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));

	const formDataB = new FormData();
	formDataB.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));

	// PUT maps on server
	await fetch(`${address}/map/buzz/4.2.2`, {
		method: "PUT",
		body: formDataA,
		headers: { ...headers },
		redirect: "manual",
	});

	await fetch(`${address}/map/buzz/4.4.2`, {
		method: "PUT",
		body: formDataB,
		headers: { ...headers },
		redirect: "manual",
	});

	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "4.2.2");

	const alias = await fetch(`${address}/map/buzz/v4`, {
		method: "PUT",
		body: aliasFormData,
		headers: { ...headers },
		redirect: "manual",
	});
	assert.strictEqual(
		alias.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// GET alias from server
	const redirect = await fetch(`${address}/map/buzz/v4`, {
		method: "GET",
		redirect: "manual",
	});
	assert.strictEqual(
		redirect.headers.get("cache-control"),
		"public, max-age=1200",
		'should be "public, max-age=1200"',
	);

	// POST alias on server
	const aliasFormDataB = new FormData();
	aliasFormDataB.append("version", "4.4.2");

	const updated = await fetch(`${address}/map/buzz/v4`, {
		method: "POST",
		body: aliasFormDataB,
		headers: { ...headers },
		redirect: "manual",
	});
	assert.strictEqual(
		updated.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// DELETE alias on server
	const deleted = await fetch(`${address}/map/buzz/v4`, {
		method: "DELETE",
		headers,
	});
	assert.strictEqual(
		deleted.headers.get("cache-control"),
		"no-store",
		'should be "no-cache"',
	);
});

test("cache-control - alias map - scoped", async () => {
	const formDataA = new FormData();
	formDataA.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));

	const formDataB = new FormData();
	formDataB.append("map", new Blob([fs.readFileSync(FIXTURE_MAP)]));

	// PUT maps on server
	await fetch(`${address}/map/@cuz/buzz/4.2.2`, {
		method: "PUT",
		body: formDataA,
		headers: { ...headers },
		redirect: "manual",
	});

	await fetch(`${address}/map/@cuz/buzz/4.4.2`, {
		method: "PUT",
		body: formDataB,
		headers: { ...headers },
		redirect: "manual",
	});

	// PUT alias on server
	const aliasFormData = new FormData();
	aliasFormData.append("version", "4.2.2");

	const alias = await fetch(`${address}/map/@cuz/buzz/v4`, {
		method: "PUT",
		body: aliasFormData,
		headers: { ...headers },
		redirect: "manual",
	});
	assert.strictEqual(
		alias.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// GET alias from server
	const redirect = await fetch(`${address}/map/@cuz/buzz/v4`, {
		method: "GET",
		redirect: "manual",
	});
	assert.strictEqual(
		redirect.headers.get("cache-control"),
		"public, max-age=1200",
		'should be "public, max-age=1200"',
	);

	// POST alias on server
	const aliasFormDataB = new FormData();
	aliasFormDataB.append("version", "4.4.2");

	const updated = await fetch(`${address}/map/@cuz/buzz/v4`, {
		method: "POST",
		body: aliasFormDataB,
		headers: { ...headers },
		redirect: "manual",
	});
	assert.strictEqual(
		updated.headers.get("cache-control"),
		"no-store",
		'should be "no-store"',
	);

	// DELETE alias on server
	const deleted = await fetch(`${address}/map/@cuz/buzz/v4`, {
		method: "DELETE",
		headers,
	});
	assert.strictEqual(
		deleted.headers.get("cache-control"),
		"no-store",
		'should be "no-cache"',
	);
});
