"use strict";

class OptsError extends Error {
    constructor(...args) {
        super(args);

        this.name = this.constructor.name;
    }

    static print(config) {
        return [
            "",
            ...JSON.stringify(config, null, 1).split("\n")
        ].join(`\n| `);
    }
}

const Opts = (function() {
    class OptsImmutableError extends OptsError {
        constructor({
            behavior,
            config
        }) {
            super(`Configuration is already immutable\nFailed to ${
                behavior
            } options:${
                OptsError.print(config)
            }`);
        }
    }

    class OptsUnknownKeyError extends OptsError {
        constructor(key) {
            super(`Option '${key}' unrecognized, see template${
                OptsError.print(DEFAULTS)
            }`);
        }
    }

    const DEFAULTS = {};

    let Frozen = false;

    const isObj = (x) => x && Object.getPrototypeOf(x) === Object.prototype;

    /// Public

    function configure(config, into = DEFAULTS) {
        if (Frozen) {
            throw new OptsImmutableError({
                behavior: "configure",
                config
            });
        }

        for (const [k, v] of Object.entries(config)) {
            const w = into[k];

            if (isObj(v) && isObj(w)) {
                configure(v, w);
                continue;
            } else if (into.hasOwnProperty(k)) {
                into[k] = v;
                continue;
            }

            throw new OptsUnknownKeyError(k);
        }
    }

    function define(config) {
        if (Frozen) {
            throw new OptsImmutableError({
                behavior: "define",
                config
            });
        }

        Object.assign(DEFAULTS, config);
    }

    Script.configured.then(() => {
        Object.freeze(DEFAULTS);
        Frozen = true;
    });

    return Object.freeze({
        get config() {
            return DEFAULTS;
        },
        configure,
        define
    });
})();
