"use strict";

const Options = (function() {
    class OptionsError extends StartupError {}

    class OptionsConfigureError extends OptionsError {
        constructor(key) {
            super(`Key "${key}" not found in template`);
        }
    }

    class OptionsDefineError extends OptionsError {
        constructor(key) {
            super(`Key "${key}" is already defined`);
        }
    }

    class OptionsImmutableError extends OptionsError {
        constructor() {
            super("Configuration is already immutable");
        }
    }

    class OptionsShapeError extends OptionsError {
        constructor(key) {
            super(`Expected record at key "${key}"`);
        }
    }

    const Config = {};

    const isRecord = (x) => {
        if (x === null || x === undefined) {
            return false;
        }

        const prototype = Object.getPrototypeOf(x);

        return prototype === Object.prototype || prototype === null;
    };

    let Frozen = false;

    /// Public

    function configure(overrides) {
        if (Frozen) {
            throw new OptionsImmutableError();
        }

        copy(overrides, Config, {
            keyPolicy: true,
            keyPolicyError: (key) => new OptionsConfigureError(key)
        });
    }

    function define(defaults) {
        if (Frozen) {
            throw new OptionsImmutableError();
        }

        copy(defaults, Config, {
            keyPolicy: false,
            keyPolicyError: (key) => new OptionsDefineError(key)
        });
    }

    /// Private

    function copy(from, into, {
        keyPolicy,
        keyPolicyError
    }) {
        for (const [k, v] of Object.entries(from)) {
            const w = into[k];

            if (isRecord(w)) {
                if (!isRecord(v)) {
                    throw new OptionsShapeError(k);
                }

                copy(v, w, {
                    keyPolicy,
                    keyPolicyError
                });

                continue;
            }

            if (into.hasOwnProperty(k) !== keyPolicy) {
                throw keyPolicyError(k);
            }

            into[k] = v;
        }
    }

    /// Init

    Script.configured.then(() => {
        Object.freeze(Config);

        Frozen = true;
    });

    return Object.freeze({
        get config() {
            return Config;
        },
        configure,
        define
    });
})();
