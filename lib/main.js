import { PassThrough } from "stream";
import compression from "@fastify/compress";
import createError from "http-errors";
import pino from "pino";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import eik from "@eik/core";
import SinkMemory from "@eik/sink-memory";
import SinkFileSystem from "@eik/sink-file-system";
import zlib from "node:zlib";

import config from "./config.js";
import * as utils from "./utils.js";

/**
 * @typedef {object} EikServiceOptions
 * @property {import('@eik/sink').default} [sink]
 * @property {import('pino').Logger} [logger]
 * @property {import('@eik/sink').default} [customSink] [Deprecated] Use sink instead
 * @property {string} [aliasCacheControl]
 * @property {string} [staleWhileRevalidateCacheControl] Set the cache-control header used by the stale-while-revalidate alias GET URLs
 * @property {string} [notFoundCacheControl="public, max-age=5"]
 * @property {number} [pkgMaxFileSize=10000000] The limit in bytes before PUT /pkg/ starts returning 413 Content Too Large
 * @property {number} [mapMaxFileSize=1000000] The limit in bytes before PUT /map/ starts returning 413 Content Too Large
 * @property {number} [imgMaxFileSize=20000000] The limit in bytes before PUT /img/ starts returning 413 Content Too Large
 */

const EikService = class EikService {
	/**
	 * @param {EikServiceOptions} [options={}]
	 */
	constructor(options = {}) {
		let { sink, logger } = options;
		const {
			customSink,
			notFoundCacheControl,
			staleWhileRevalidateCacheControl,
			aliasCacheControl,
			pkgMaxFileSize = 10000000,
			mapMaxFileSize = 1000000,
			imgMaxFileSize = 20000000,
		} = options;
		this._notFoundCacheControl = notFoundCacheControl || "public, max-age=5";

		if (!logger) {
			// @ts-expect-error This is in fact callable
			logger = pino({
				// @ts-ignore
				level: config.get("log.level"),
				name: config.get("name"),
			});
		}

		if (sink) {
			logger.info(`Using the provided sink ${sink.constructor.name}`);
		} else if (customSink) {
			logger.warn(
				"The `customSink` option is deprecated and will be removed at a later stage. Use `sink` to remove this warning.",
			);
			sink = customSink;
		} else if (config.get("sink.type") === "mem") {
			logger.info(
				`Server is running with a in memory sink. Uploaded files will be lost on restart!`,
			);
			sink = new SinkMemory();
		} else {
			logger.info(
				`Server is running with the file system sink. Uploaded files will be stored under "${config.get("sink.path")}"`,
			);
			sink = new SinkFileSystem({
				sinkFsRootPath: config.get("sink.path"),
			});
		}

		// Transform organization config
		const organizations = config
			.get("organization.hostnames")
			.map((hostname) => [hostname, config.get("organization.name")]);

		this._versionsGet = new eik.http.VersionsGet({
			organizations,
			sink,
			logger,
		});
		this._aliasPost = new eik.http.AliasPost({
			organizations,
			sink,
			logger,
		});
		this._aliasDel = new eik.http.AliasDel({ organizations, sink, logger });
		this._aliasGet = new eik.http.AliasGet({
			organizations,
			sink,
			logger,
			cacheControl: aliasCacheControl,
		});
		this._aliasGetSWR = new eik.http.AliasGetV2({
			organizations,
			sink,
			logger,
			cacheControl: staleWhileRevalidateCacheControl,
		});
		this._aliasPut = new eik.http.AliasPut({ organizations, sink, logger });
		this._authPost = new eik.http.AuthPost({
			organizations,
			logger,
			authKey: config.get("basicAuth.key"),
		});
		this._pkgLog = new eik.http.PkgLog({ organizations, sink, logger });
		this._pkgGet = new eik.http.PkgGet({ organizations, sink, logger });
		this._pkgPut = new eik.http.PkgPut({
			organizations,
			sink,
			logger,
			pkgMaxFileSize,
		});
		this._imgPut = new eik.http.PkgPut({
			organizations,
			sink,
			logger,
			pkgMaxFileSize: imgMaxFileSize,
		});
		this._mapGet = new eik.http.MapGet({ organizations, sink, logger });
		this._mapPut = new eik.http.MapPut({
			organizations,
			sink,
			logger,
			mapMaxFileSize,
		});

		const mergeStreams = (...streams) => {
			const str = new PassThrough({ objectMode: true });

			// Avoid hitting the max listeners limit when multiple
			// streams is piped into the same stream.
			str.on("pipe", () => {
				str.setMaxListeners(str.getMaxListeners() + 1);
			});

			str.on("unpipe", () => {
				str.setMaxListeners(str.getMaxListeners() - 1);
			});

			for (const stm of streams) {
				stm.on("error", (err) => {
					logger.error(err);
				});
				stm.pipe(str);
			}
			return str;
		};

		// pipe metrics
		const metrics = mergeStreams(
			this._versionsGet.metrics,
			this._aliasPost.metrics,
			this._aliasDel.metrics,
			this._aliasGet.metrics,
			this._aliasPut.metrics,
			this._authPost.metrics,
			this._pkgLog.metrics,
			this._pkgGet.metrics,
			this._pkgPut.metrics,
			this._mapGet.metrics,
			this._mapPut.metrics,
			sink.metrics,
		);

		metrics.on("error", (err) => {
			logger.error(err);
		});

		this.metrics = metrics;
		this.config = config;
		this.logger = logger;
		this.sink = sink;

		// Print warnings

		if (
			config.get("basicAuth.type") === "key" &&
			config.get("basicAuth.key") === config.default("basicAuth.key")
		) {
			logger.warn(
				"Server is running with default basic authorization key configured! For security purposes, it is highly recommended to set a custom value!",
			);
		}

		if (config.get("jwt.secret") === config.default("jwt.secret")) {
			logger.warn(
				"Server is running with default jwt secret configured! For security purposes, it is highly recommended to set a custom value!",
			);
		}

		// Print info

		const hosts = config.get("organization.hostnames").join(", ");
		logger.info(
			`Files for "${hosts}" will be stored in the "${config.get("organization.name")}" organization space`,
		);
	}

	async health() {
		const health = new eik.HealthCheck({
			logger: this.logger,
			sink: this.sink,
		});
		await health.check();
	}

	api() {
		/** @param {import('fastify').FastifyInstance} app */
		return async (app) => {
			if (!app.initialConfig.ignoreTrailingSlash) {
				this.logger.warn(
					'Fastify is configured with "ignoreTrailingSlash" set to "false". Its adviced to set "ignoreTrailingSlash" to "true"',
				);
			}

			await app.register(cors);

			// Authentication
			app.register(jwt, {
				secret: config.get("jwt.secret"),
				messages: {
					badRequestErrorMessage:
						'Autorization header is malformatted. Format is "Authorization: Bearer [token]"',
					noAuthorizationInHeaderMessage: "Autorization header is missing!",
					authorizationTokenExpiredMessage: "Authorization token expired",
					authorizationTokenInvalid: "Authorization token is invalid",
				},
			});

			app.decorate("authenticate", async (request, reply) => {
				try {
					await request.jwtVerify();
				} catch (error) {
					reply.send(error);
				}
			});

			const authOptions = {
				// @ts-expect-error We decorate it above
				preValidation: [app.authenticate],
			};

			// Handle multipart upload
			const _multipart = Symbol("multipart");

			function setMultipart(req, payload, cb) {
				req.raw[_multipart] = true;
				cb();
			}
			app.addContentTypeParser("multipart/form-data", setMultipart);

			// Compression
			await app.register(compression, {
				global: config.get("compression.global"),
				brotliOptions: {
					// The default is 4 (was 11 before @fastify/compress@^7.0.0).
					// 5 sees benefits for file sizes above 64Kb, of which we have several.
					// https://github.com/fastify/fastify-compress/pull/278#issuecomment-1914778795
					[zlib.constants.BROTLI_PARAM_QUALITY]: 5,
				},
			});

			// 404 handling
			app.setNotFoundHandler((request, reply) => {
				reply.header("cache-control", this._notFoundCacheControl);
				reply.type("text/plain");
				reply.code(404);
				reply.send("Not found");
			});

			// Error handling
			app.setErrorHandler((error, request, reply) => {
				this.logger.debug(
					"Error occured during request. Error is available on trace log level.",
				);
				this.logger.trace(error);
				reply.header("cache-control", "no-store");
				if (error.statusCode) {
					if (error.statusCode === 404) {
						reply.header("cache-control", this._notFoundCacheControl);
					}
					reply.send(error);
					return;
				}
				reply.send(createError(error.statusCode || 500));
			});

			//
			// Routes
			//

			const authPostRoutes = async (request, reply) => {
				const outgoing = await this._authPost.handler(request.raw);

				// Workaround due to .jwt.sign() being able to only
				// deal with object literals for some reason :/
				const body = JSON.parse(JSON.stringify(outgoing.body));

				const token = app.jwt.sign(body, {
					expiresIn: config.get("jwt.expire"),
				});

				reply.header("cache-control", outgoing.cacheControl);
				reply.type(outgoing.mimeType);
				reply.code(outgoing.statusCode);
				reply.send({ token });
			};

			const pkgGetRoute = async (request, reply) => {
				const params = utils.sanitizeParameters(request.raw.url);
				const outgoing = await this._pkgGet.handler(
					request.raw,
					params.type,
					params.name,
					params.version,
					params.extras,
				);
				reply.header("cache-control", outgoing.cacheControl);
				reply.header("etag", outgoing.etag);
				reply.type(outgoing.mimeType);
				reply.code(outgoing.statusCode);
				return reply.send(outgoing.stream);
			};

			const pkgLogRoute = async (request, reply) => {
				const params = utils.sanitizeParameters(request.raw.url);
				const outgoing = await this._pkgLog.handler(
					request.raw,
					params.type,
					params.name,
					params.version,
				);
				reply.header("cache-control", outgoing.cacheControl);
				reply.header("etag", outgoing.etag);
				reply.type(outgoing.mimeType);
				reply.code(outgoing.statusCode);
				return reply.send(outgoing.stream);
			};

			const versionsGetRoute = async (request, reply) => {
				const params = utils.sanitizeParameters(request.raw.url);
				const outgoing = await this._versionsGet.handler(
					request.raw,
					params.type,
					params.name,
				);
				reply.header("cache-control", outgoing.cacheControl);
				reply.header("etag", outgoing.etag);
				reply.type(outgoing.mimeType);
				reply.code(outgoing.statusCode);
				return reply.send(outgoing.stream);
			};

			const pkgPutRoute = async (request, reply) => {
				const params = utils.sanitizeParameters(request.raw.url);
				const outgoing = await this._pkgPut.handler(
					request.raw,
					request.user,
					params.type,
					params.name,
					params.version,
				);
				reply.header("cache-control", outgoing.cacheControl);
				reply.type(outgoing.mimeType);
				reply.code(outgoing.statusCode);
				reply.redirect(outgoing.location);
			};

			const imgPutRoute = async (request, reply) => {
				const params = utils.sanitizeParameters(request.raw.url);
				const outgoing = await this._imgPut.handler(
					request.raw,
					request.user,
					params.type,
					params.name,
					params.version,
				);
				reply.header("cache-control", outgoing.cacheControl);
				reply.type(outgoing.mimeType);
				reply.code(outgoing.statusCode);
				reply.redirect(outgoing.location);
			};

			const mapGetRoute = async (request, reply) => {
				const params = utils.sanitizeParameters(request.raw.url);
				const outgoing = await this._mapGet.handler(
					request.raw,
					params.name,
					params.version,
				);
				reply.header("cache-control", outgoing.cacheControl);
				reply.header("etag", outgoing.etag);
				reply.type(outgoing.mimeType);
				reply.code(outgoing.statusCode);
				return reply.send(outgoing.stream);
			};

			const mapPutRoute = async (request, reply) => {
				const params = utils.sanitizeParameters(request.raw.url);
				const outgoing = await this._mapPut.handler(
					request.raw,
					request.user,
					params.name,
					params.version,
				);
				reply.header("cache-control", outgoing.cacheControl);
				reply.type(outgoing.mimeType);
				reply.code(outgoing.statusCode);
				reply.redirect(outgoing.location);
			};

			const aliasGetRoute = async (request, reply) => {
				const params = utils.sanitizeParameters(request.raw.url);
				const outgoing = await this._aliasGet.handler(
					request.raw,
					params.type,
					params.name,
					params.alias,
					params.extras,
				);
				reply.header("cache-control", outgoing.cacheControl);
				reply.type(outgoing.mimeType);
				reply.code(outgoing.statusCode);
				reply.redirect(outgoing.location);
			};

			// Relies on stale-while-revalidate to serve the aliased asset without a redirect
			const aliasGetSWRRoute = async (request, reply) => {
				const params = utils.sanitizeParameters(request.raw.url);
				const outgoing = await this._aliasGetSWR.handler(
					request.raw,
					params.type,
					params.name,
					params.alias,
					params.extras,
				);
				reply.header("cache-control", outgoing.cacheControl);
				reply.header("etag", outgoing.etag);
				reply.type(outgoing.mimeType);
				reply.code(outgoing.statusCode);
				return reply.send(outgoing.stream);
			};

			const aliasPutRoute = async (request, reply) => {
				const params = utils.sanitizeParameters(request.raw.url);
				const outgoing = await this._aliasPut.handler(
					request.raw,
					request.user,
					params.type,
					params.name,
					params.alias,
				);
				reply.header("cache-control", outgoing.cacheControl);
				reply.type(outgoing.mimeType);
				reply.code(outgoing.statusCode);
				reply.redirect(outgoing.location);
			};

			const aliasPostRoute = async (request, reply) => {
				const params = utils.sanitizeParameters(request.raw.url);
				const outgoing = await this._aliasPost.handler(
					request.raw,
					request.user,
					params.type,
					params.name,
					params.alias,
				);
				reply.header("cache-control", outgoing.cacheControl);
				reply.type(outgoing.mimeType);
				reply.code(outgoing.statusCode);
				reply.redirect(outgoing.location);
			};

			const aliasDelRoute = async (request, reply) => {
				const params = utils.sanitizeParameters(request.raw.url);
				const outgoing = await this._aliasDel.handler(
					request.raw,
					request.user,
					params.type,
					params.name,
					params.alias,
				);
				reply.header("cache-control", outgoing.cacheControl);
				reply.type(outgoing.mimeType);
				reply.code(outgoing.statusCode);
				reply.send(outgoing.body);
			};

			//
			// Authentication
			//

			// curl -X POST -i -F key=foo http://localhost:4001/auth/login

			app.post(`/${eik.prop.base_auth}/login`, authPostRoutes);

			//
			// Packages
			//

			// Get public package - scoped
			// curl -X GET http://localhost:4001/pkg/@cuz/fuzz/8.4.1/main/index.js
			app.get(`/${eik.prop.base_pkg}/@:scope/:name/:version/*`, pkgGetRoute);

			// Get public package - non-scoped
			// curl -X GET http://localhost:4001/pkg/fuzz/8.4.1/main/index.js
			app.get(`/${eik.prop.base_pkg}/:name/:version/*`, pkgGetRoute);

			// Get package overview - scoped
			// curl -X GET http://localhost:4001/pkg/@cuz/fuzz/8.4.1/
			app.get(`/${eik.prop.base_pkg}/@:scope/:name/:version`, pkgLogRoute);

			// Get package overview - non-scoped
			// curl -X GET http://localhost:4001/pkg/fuzz/8.4.1/
			app.get(`/${eik.prop.base_pkg}/:name/:version`, pkgLogRoute);

			// Get package versions - scoped
			// curl -X GET http://localhost:4001/pkg/@cuz/fuzz/
			app.get(`/${eik.prop.base_pkg}/@:scope/:name`, versionsGetRoute);

			// Get package versions - non-scoped
			// curl -X GET http://localhost:4001/pkg/fuzz/
			app.get(`/${eik.prop.base_pkg}/:name`, versionsGetRoute);

			// Put package - scoped
			// curl -X PUT -i -F filedata=@archive.tgz http://localhost:4001/pkg/@cuz/fuzz/8.4.1/
			app.put(
				`/${eik.prop.base_pkg}/@:scope/:name/:version`,
				authOptions,
				pkgPutRoute,
			);

			// Put package - non-scoped
			// curl -X PUT -i -F filedata=@archive.tgz http://localhost:4001/pkg/fuzz/8.4.1/
			app.put(`/${eik.prop.base_pkg}/:name/:version`, authOptions, pkgPutRoute);

			//
			// NPM Packages
			//

			// Get public NPM package - scoped
			// curl -X GET http://localhost:4001/npm/@cuz/fuzz/8.4.1/main/index.js
			app.get(`/${eik.prop.base_npm}/@:scope/:name/:version/*`, pkgGetRoute);

			// Get public NPM package - non-scoped
			// curl -X GET http://localhost:4001/npm/fuzz/8.4.1/main/index.js
			app.get(`/${eik.prop.base_npm}/:name/:version/*`, pkgGetRoute);

			// Get NPM package overview - scoped
			// curl -X GET http://localhost:4001/npm/@cuz/fuzz/8.4.1/
			app.get(`/${eik.prop.base_npm}/@:scope/:name/:version`, pkgLogRoute);

			// Get NPM package overview - non-scoped
			// curl -X GET http://localhost:4001/npm/fuzz/8.4.1/
			app.get(`/${eik.prop.base_npm}/:name/:version`, pkgLogRoute);

			// Get NPM package versions - scoped
			// curl -X GET http://localhost:4001/npm/@cuz/fuzz/
			app.get(`/${eik.prop.base_npm}/@:scope/:name`, versionsGetRoute);

			// Get NPM package versions - non-scoped
			// curl -X GET http://localhost:4001/npm/fuzz/
			app.get(`/${eik.prop.base_npm}/:name`, versionsGetRoute);

			// Put NPM package - scoped
			// curl -X PUT -i -F filedata=@archive.tgz http://localhost:4001/npm/@cuz/fuzz/8.4.1/
			app.put(
				`/${eik.prop.base_npm}/@:scope/:name/:version`,
				authOptions,
				pkgPutRoute,
			);

			// Put NPM package - non-scoped
			// curl -X PUT -i -F filedata=@archive.tgz http://localhost:4001/npm/fuzz/8.4.1/
			app.put(`/${eik.prop.base_npm}/:name/:version`, authOptions, pkgPutRoute);

			//
			// Image Packages
			//

			// Get public IMG package - scoped
			// curl -X GET http://localhost:4001/img/@cuz/fuzz/8.4.1/main/picture.jpg
			app.get(`/${eik.prop.base_img}/@:scope/:name/:version/*`, pkgGetRoute);

			// Get public IMG package - non-scoped
			// curl -X GET http://localhost:4001/img/fuzz/8.4.1/main/picture.jpg
			app.get(`/${eik.prop.base_img}/:name/:version/*`, pkgGetRoute);

			// Get IMG package overview - scoped
			// curl -X GET http://localhost:4001/img/@cuz/fuzz/8.4.1/
			app.get(`/${eik.prop.base_img}/@:scope/:name/:version`, pkgLogRoute);

			// Get IMG package overview - non-scoped
			// curl -X GET http://localhost:4001/img/fuzz/8.4.1/
			app.get(`/${eik.prop.base_img}/:name/:version`, pkgLogRoute);

			// Get IMG package versions - scoped
			// curl -X GET http://localhost:4001/img/@cuz/fuzz/
			app.get(`/${eik.prop.base_img}/@:scope/:name`, versionsGetRoute);

			// Get IMG package versions - non-scoped
			// curl -X GET http://localhost:4001/img/fuzz/
			app.get(`/${eik.prop.base_img}/:name`, versionsGetRoute);

			// Put IMG package - scoped
			// curl -X PUT -i -F filedata=@archive.tgz http://localhost:4001/img/@cuz/fuzz/8.4.1/
			app.put(
				`/${eik.prop.base_img}/@:scope/:name/:version`,
				authOptions,
				imgPutRoute,
			);

			// Put IMG package - non-scoped
			// curl -X PUT -i -F filedata=@archive.tgz http://localhost:4001/img/fuzz/8.4.1/
			app.put(`/${eik.prop.base_img}/:name/:version`, authOptions, imgPutRoute);

			//
			// Import Maps
			//

			// Get map - scoped
			// curl -X GET http://localhost:4001/map/@cuz/buzz/4.2.2
			app.get(`/${eik.prop.base_map}/@:scope/:name/:version`, mapGetRoute);

			// Get map - non-scoped
			// curl -X GET http://localhost:4001/map/buzz/4.2.2
			app.get(`/${eik.prop.base_map}/:name/:version`, mapGetRoute);

			// Get map versions - scoped
			// curl -X GET http://localhost:4001/map/@cuz/buzz
			app.get(`/${eik.prop.base_map}/@:scope/:name`, versionsGetRoute);

			// Get map versions - non-scoped
			// curl -X GET http://localhost:4001/map/buzz
			app.get(`/${eik.prop.base_map}/:name`, versionsGetRoute);

			// Put map - scoped
			// curl -X PUT -i -F map=@import-map.json http://localhost:4001/map/@cuz/buzz/4.2.2
			app.put(
				`/${eik.prop.base_map}/@:scope/:name/:version`,
				authOptions,
				mapPutRoute,
			);

			// Put map - non-scoped
			// curl -X PUT -i -F map=@import-map.json http://localhost:4001/map/buzz/4.2.2
			app.put(`/${eik.prop.base_map}/:name/:version`, authOptions, mapPutRoute);

			//
			// Alias Packages
			//

			// curl -X GET -L http://localhost:4001/pkg/@cuz/fuzz/v8
			app.get(`/${eik.prop.base_pkg}/@:scope/:name/v:alias`, aliasGetRoute);

			// curl -X GET -L http://localhost:4001/pkg/fuzz/v8
			app.get(`/${eik.prop.base_pkg}/:name/v:alias`, aliasGetRoute);

			// curl -X GET -L http://localhost:4001/pkg/@cuz/fuzz/v8/main/index.js
			app.get(`/${eik.prop.base_pkg}/@:scope/:name/v:alias/*`, aliasGetRoute);

			// curl -X GET -L http://localhost:4001/pkg/fuzz/v8/main/index.js
			app.get(`/${eik.prop.base_pkg}/:name/v:alias/*`, aliasGetRoute);

			// Redirect these as usual, just a dev nicety
			// curl -X GET -L http://localhost:4001/pkg/@cuz/fuzz/~8
			app.get(`/${eik.prop.base_pkg}/@:scope/:name/~:alias`, aliasGetRoute);

			// Redirect these as usual, just a dev nicety
			// curl -X GET -L http://localhost:4001/pkg/fuzz/~8
			app.get(`/${eik.prop.base_pkg}/:name/~:alias`, aliasGetRoute);

			// curl -X GET -L http://localhost:4001/pkg/@cuz/fuzz/~8/main/index.js
			app.get(
				`/${eik.prop.base_pkg}/@:scope/:name/~:alias/*`,
				aliasGetSWRRoute,
			);

			// curl -X GET -L http://localhost:4001/pkg/fuzz/~8/main/index.js
			app.get(`/${eik.prop.base_pkg}/:name/~:alias/*`, aliasGetSWRRoute);

			// curl -X PUT -i -F version=8.4.1 http://localhost:4001/pkg/@cuz/fuzz/v8
			app.put(
				`/${eik.prop.base_pkg}/@:scope/:name/v:alias`,
				authOptions,
				aliasPutRoute,
			);

			// curl -X PUT -i -F version=8.4.1 http://localhost:4001/pkg/fuzz/v8
			app.put(
				`/${eik.prop.base_pkg}/:name/v:alias`,
				authOptions,
				aliasPutRoute,
			);

			// curl -X POST -i -F version=8.4.1 http://localhost:4001/pkg/@cuz/lit-html/v8
			app.post(
				`/${eik.prop.base_pkg}/@:scope/:name/v:alias`,
				authOptions,
				aliasPostRoute,
			);

			// curl -X POST -i -F version=8.4.1 http://localhost:4001/pkg/lit-html/v8
			app.post(
				`/${eik.prop.base_pkg}/:name/v:alias`,
				authOptions,
				aliasPostRoute,
			);

			// curl -X DELETE http://localhost:4001/pkg/@cuz/fuzz/v8
			app.delete(
				`/${eik.prop.base_pkg}/@:scope/:name/v:alias`,
				authOptions,
				aliasDelRoute,
			);

			// curl -X DELETE http://localhost:4001/pkg/fuzz/v8
			app.delete(
				`/${eik.prop.base_pkg}/:name/v:alias`,
				authOptions,
				aliasDelRoute,
			);

			//
			// Alias NPM Packages
			//

			// curl -X GET -L http://localhost:4001/npm/@cuz/fuzz/v8
			app.get(`/${eik.prop.base_npm}/@:scope/:name/v:alias`, aliasGetRoute);

			// curl -X GET -L http://localhost:4001/npm/fuzz/v8
			app.get(`/${eik.prop.base_npm}/:name/v:alias`, aliasGetRoute);

			// curl -X GET -L http://localhost:4001/npm/@cuz/fuzz/v8/main/index.js
			app.get(`/${eik.prop.base_npm}/@:scope/:name/v:alias/*`, aliasGetRoute);

			// curl -X GET -L http://localhost:4001/npm/fuzz/v8/main/index.js
			app.get(`/${eik.prop.base_npm}/:name/v:alias/*`, aliasGetRoute);

			// Redirect these as usual, just a dev nicety
			// curl -X GET -L http://localhost:4001/pkg/@cuz/fuzz/~8
			app.get(`/${eik.prop.base_npm}/@:scope/:name/~:alias`, aliasGetRoute);

			// Redirect these as usual, just a dev nicety
			// curl -X GET -L http://localhost:4001/pkg/fuzz/~8
			app.get(`/${eik.prop.base_npm}/:name/~:alias`, aliasGetRoute);

			// curl -X GET -L http://localhost:4001/pkg/@cuz/fuzz/~8/main/index.js
			app.get(
				`/${eik.prop.base_npm}/@:scope/:name/~:alias/*`,
				aliasGetSWRRoute,
			);

			// curl -X GET -L http://localhost:4001/pkg/fuzz/~8/main/index.js
			app.get(`/${eik.prop.base_npm}/:name/~:alias/*`, aliasGetSWRRoute);

			// curl -X PUT -i -F version=8.4.1 http://localhost:4001/npm/@cuz/fuzz/v8
			app.put(
				`/${eik.prop.base_npm}/@:scope/:name/v:alias`,
				authOptions,
				aliasPutRoute,
			);

			// curl -X PUT -i -F version=8.4.1 http://localhost:4001/npm/fuzz/v8
			app.put(
				`/${eik.prop.base_npm}/:name/v:alias`,
				authOptions,
				aliasPutRoute,
			);

			// curl -X POST -i -F version=8.4.1 http://localhost:4001/npm/@cuz/lit-html/v8
			app.post(
				`/${eik.prop.base_npm}/@:scope/:name/v:alias`,
				authOptions,
				aliasPostRoute,
			);

			// curl -X POST -i -F version=8.4.1 http://localhost:4001/npm/lit-html/v8
			app.post(
				`/${eik.prop.base_npm}/:name/v:alias`,
				authOptions,
				aliasPostRoute,
			);

			// curl -X DELETE http://localhost:4001/npm/@cuz/fuzz/v8
			app.delete(
				`/${eik.prop.base_npm}/@:scope/:name/v:alias`,
				authOptions,
				aliasDelRoute,
			);

			// curl -X DELETE http://localhost:4001/npm/fuzz/v8
			app.delete(
				`/${eik.prop.base_npm}/:name/v:alias`,
				authOptions,
				aliasDelRoute,
			);

			//
			// Alias Image Packages
			//

			// curl -X GET -L http://localhost:4001/img/@cuz/fuzz/v8
			app.get(`/${eik.prop.base_img}/@:scope/:name/v:alias`, aliasGetRoute);

			// curl -X GET -L http://localhost:4001/img/fuzz/v8
			app.get(`/${eik.prop.base_img}/:name/v:alias`, aliasGetRoute);

			// curl -X GET -L http://localhost:4001/img/@cuz/fuzz/v8/main/index.js
			app.get(`/${eik.prop.base_img}/@:scope/:name/v:alias/*`, aliasGetRoute);

			// curl -X GET -L http://localhost:4001/img/fuzz/v8/main/index.js
			app.get(`/${eik.prop.base_img}/:name/v:alias/*`, aliasGetRoute);

			// Redirect these as usual, just a dev nicety
			// curl -X GET -L http://localhost:4001/pkg/@cuz/fuzz/~8
			app.get(`/${eik.prop.base_img}/@:scope/:name/~:alias`, aliasGetRoute);

			// Redirect these as usual, just a dev nicety
			// curl -X GET -L http://localhost:4001/pkg/fuzz/~8
			app.get(`/${eik.prop.base_img}/:name/~:alias`, aliasGetRoute);

			// curl -X GET -L http://localhost:4001/pkg/@cuz/fuzz/~8/main/index.js
			app.get(
				`/${eik.prop.base_img}/@:scope/:name/~:alias/*`,
				aliasGetSWRRoute,
			);

			// curl -X GET -L http://localhost:4001/pkg/fuzz/~8/main/index.js
			app.get(`/${eik.prop.base_img}/:name/~:alias/*`, aliasGetSWRRoute);

			// curl -X PUT -i -F version=8.4.1 http://localhost:4001/img/@cuz/fuzz/v8
			app.put(
				`/${eik.prop.base_img}/@:scope/:name/v:alias`,
				authOptions,
				aliasPutRoute,
			);

			// curl -X PUT -i -F version=8.4.1 http://localhost:4001/img/fuzz/v8
			app.put(
				`/${eik.prop.base_img}/:name/v:alias`,
				authOptions,
				aliasPutRoute,
			);

			// curl -X POST -i -F version=8.4.1 http://localhost:4001/img/@cuz/lit-html/v8
			app.post(
				`/${eik.prop.base_img}/@:scope/:name/v:alias`,
				authOptions,
				aliasPostRoute,
			);

			// curl -X POST -i -F version=8.4.1 http://localhost:4001/img/lit-html/v8
			app.post(
				`/${eik.prop.base_img}/:name/v:alias`,
				authOptions,
				aliasPostRoute,
			);

			// curl -X DELETE http://localhost:4001/img/@cuz/fuzz/v8
			app.delete(
				`/${eik.prop.base_img}/@:scope/:name/v:alias`,
				authOptions,
				aliasDelRoute,
			);

			// curl -X DELETE http://localhost:4001/img/fuzz/v8
			app.delete(
				`/${eik.prop.base_img}/:name/v:alias`,
				authOptions,
				aliasDelRoute,
			);

			//
			// Alias Import Maps
			//

			// curl -X GET -L http://localhost:4001/map/@cuz/buzz/v4
			app.get(`/${eik.prop.base_map}/@:scope/:name/v:alias`, aliasGetRoute);

			// curl -X GET -L http://localhost:4001/map/buzz/v4
			app.get(`/${eik.prop.base_map}/:name/v:alias`, aliasGetRoute);

			// curl -X PUT -i -F version=4.2.2 http://localhost:4001/map/@cuz/buzz/v4
			app.put(
				`/${eik.prop.base_map}/@:scope/:name/v:alias`,
				authOptions,
				aliasPutRoute,
			);

			// curl -X PUT -i -F version=4.2.2 http://localhost:4001/map/buzz/v4
			app.put(
				`/${eik.prop.base_map}/:name/v:alias`,
				authOptions,
				aliasPutRoute,
			);

			// curl -X POST -i -F version=4.4.2 http://localhost:4001/map/@cuz/buzz/v4
			app.post(
				`/${eik.prop.base_map}/@:scope/:name/v:alias`,
				authOptions,
				aliasPostRoute,
			);

			// curl -X POST -i -F version=4.4.2 http://localhost:4001/map/buzz/v4
			app.post(
				`/${eik.prop.base_map}/:name/v:alias`,
				authOptions,
				aliasPostRoute,
			);

			// curl -X DELETE http://localhost:4001/map/@cuz/buzz/v4
			app.delete(
				`/${eik.prop.base_map}/@:scope/:name/v:alias`,
				authOptions,
				aliasDelRoute,
			);

			// curl -X DELETE http://localhost:4001/map/buzz/v4
			app.delete(
				`/${eik.prop.base_map}/:name/v:alias`,
				authOptions,
				aliasDelRoute,
			);
		};
	}
};

export default EikService;
