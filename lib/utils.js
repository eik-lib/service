'use strict';

const path = require('path');

const sanitizeExtras = (extras, version) => {
    if (version && extras) {
        return path.join(version, extras);
    }
    return extras || '';
};
module.exports.sanitizeExtras = sanitizeExtras;

const sanitizeName = (scope, name) => {
    if (scope && name) {
        return path.join(scope, name);
    }
    return scope || '';
};
module.exports.sanitizeName = sanitizeName;

const sanitizeAlias = (alias = '') => {
    if (alias.startsWith('v')) {
        return alias.slice(1);
    }
    return alias;
};
module.exports.sanitizeAlias = sanitizeAlias;

const sanitizeParameters = (url = '') => {
    const paths = url.split('/');

    if (paths[2] && paths[2].startsWith('@')) {
        return {
            version: paths[4] || '',
            extras: sanitizeExtras(paths.slice(5).join('/')),
            alias: sanitizeAlias(paths[4]),
            name: sanitizeName(paths[2] || '', paths[3] || ''),
            type: paths[1] || '',
        };
    }

    return {
        version: paths[3] || '',
        extras: sanitizeExtras(paths.slice(4).join('/')),
        alias: sanitizeAlias(paths[3]),
        name: sanitizeName(paths[2] || ''),
        type: paths[1] || '',
    };
};
module.exports.sanitizeParameters = sanitizeParameters;
