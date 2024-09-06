/* eslint-disable no-unused-vars */
import convict from "convict";
import yaml from "js-yaml";
import pino from "pino";
import path from "path";
import fs from "fs";
import os from "os";

const CWD = process.cwd();

let pack = {};
try {
	pack = JSON.parse(fs.readFileSync(path.join(CWD, "package.json"), "utf-8"));
} catch (error) {
	/* empty */
}

convict.addParser({ extension: ["yml", "yaml"], parse: yaml.load });

convict.addFormat({
	name: "secret-string",
	validate: (value) => {
		if (typeof value !== "string") {
			throw new Error("Value must be a String");
		}
	},
	coerce: (value) => {
		if (path.isAbsolute(value)) {
			try {
				const file = fs.readFileSync(value);
				return file.toString();
			} catch (error) {
				throw new Error(`Config could not load secret from path: ${value}`);
			}
		}
		return value;
	},
});

const conf = convict({
	name: {
		doc: "Name of the apllication",
		default: pack.name,
		format: String,
	},
	env: {
		doc: "Applicaton environments",
		format: ["development", "production"],
		default: "development",
		env: "NODE_ENV",
		arg: "node-env",
	},
	metrics: {
		format: Boolean,
		default: true,
		env: "METRICS",
	},
	log: {
		level: {
			doc: "Log level to log at",
			format: ["trace", "debug", "info", "warn", "error", "fatal"],
			default: "info",
			env: "LOG_LEVEL",
			arg: "log-level",
		},
	},
	http: {
		http2: {
			doc: "Enable http2 for the server",
			format: Boolean,
			default: false,
			env: "HTTP_HTTP2",
		},
		address: {
			doc: "The address the http server should bind to",
			format: String,
			default: "localhost",
			env: "HTTP_ADDRESS",
		},
		port: {
			doc: "The port the http server should bind to",
			format: "port",
			default: 4001,
			env: "HTTP_PORT",
		},
	},
	compression: {
		global: {
			doc: "Enable global compression for all http routes",
			format: Boolean,
			default: true,
			env: "COMPRESSION_GLOBAL",
		},
	},
	jwt: {
		secret: {
			doc: "Secret used for JWT signing",
			format: "secret-string",
			default: "change_me",
			env: "AUTH_JWT_SECRET",
			sensitive: true,
		},
		expire: {
			doc: "Expire time for JWT",
			format: String,
			default: "60d",
			env: "AUTH_JWT_EXPIRE",
		},
	},
	basicAuth: {
		type: {
			doc: "Type of basic auth to use",
			format: ["key", "disabled"],
			default: "key",
			env: "BASIC_AUTH_TYPE",
		},
		key: {
			doc: "Key used for basic authorization",
			format: "secret-string",
			default: "change_me",
			env: "BASIC_AUTH_KEY",
			sensitive: true,
		},
	},
	organization: {
		name: {
			doc: "Organization name - Used as a folder name in the storage of files",
			format: String,
			default: "local",
			env: "ORG_NAME",
		},
		hostnames: {
			doc: "Hostnames the organization maps to",
			format: Array,
			default: ["localhost", "127.0.0.1"],
			env: "ORG_HOSTNAMES",
		},
	},
	sink: {
		type: {
			doc: "Type of sink to use",
			format: ["fs", "mem", "test"],
			default: "fs",
			env: "SINK_TYPE",
		},
		path: {
			doc: 'Absolute path to store files in when using the "fs" sink',
			format: String,
			default: path.join(os.tmpdir(), "eik"),
			env: "SINK_PATH",
		},
	},
});

const env = conf.get("env");

// @ts-expect-error This is in fact callable
const logger = pino({
	level: conf.get("log.level"),
	name: conf.get("name"),
});

try {
	conf.loadFile(path.join(CWD, "config", `${env}.yaml`));
} catch (error) {
	logger.error(error);
}

conf.validate();

export default conf;
