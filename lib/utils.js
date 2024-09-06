import path from "path";

function doJoin(a, b) {
	return path.join(a, b).replace(/\\/g, "/");
}

const sanitizeExtras = (extras, version) => {
	if (version && extras) {
		return doJoin(version, extras);
	}
	return extras || "";
};

const sanitizeName = (scope, name) => {
	if (scope && name) {
		return doJoin(scope, name);
	}
	return scope || "";
};

const sanitizeAlias = (alias = "") => {
	if (alias.startsWith("v")) {
		return alias.slice(1);
	}
	return alias;
};

const sanitizeParameters = (url = "") => {
	const { pathname } = new URL(url, "http://localhost/");
	const paths = pathname.split("/");

	if (paths[2] && paths[2].startsWith("@")) {
		return {
			version: paths[4] || "",
			extras: sanitizeExtras(paths.slice(5).join("/")),
			alias: sanitizeAlias(paths[4]),
			name: sanitizeName(paths[2] || "", paths[3] || ""),
			type: paths[1] || "",
		};
	}

	return {
		version: paths[3] || "",
		extras: sanitizeExtras(paths.slice(4).join("/")),
		alias: sanitizeAlias(paths[3]),
		name: sanitizeName(paths[2] || ""),
		type: paths[1] || "",
	};
};

export { sanitizeParameters, sanitizeExtras, sanitizeAlias, sanitizeName };
