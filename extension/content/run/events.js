"use strict";

const Events = (function() {
    const Registry = new Map();

    let MainController = new AbortController();

    const across = (x, fn) => {
        if (Array.isArray(x)) {
            for (const v of x) {
                fn(v);
            }
        } else{
            fn(x);
        }
    };

    /// Public

    function listen(spec, {
        managed = true
    } = {}) {
        const symbol = Symbol(`events.key:${spec.type}`);

        Registry.set(symbol, {
            spec,
            managed
        });

        add(spec, {
            managed
        });

        return symbol;
    }

    function resume() {
        if (active()) {
            return;
        }

        MainController = new AbortController();

        for (const { spec, managed } of Registry.values()) {
            if (!managed) {
                continue;
            }

            add(spec, {
                managed
            });
        }
    }

    function suspend() {
        if (!active()) {
            return;
        }

        MainController.abort();
        MainController = null;
    }

    function unlisten(symbol) {
        across(symbol, (s) => {
            const record = Registry.get(s);

            if (record === undefined) {
                return;
            }

            const {
                spec
            } = record;

            Registry.delete(s);

            remove(spec);
        });
    }

    /// Private

    function active() {
        return MainController !== null;
    }

    function add({
        target = document,
        type,
        handler,
        options
    }, {
        managed
    }) {
        if (!active()) {
            return;
        }

        const signal = managed
            ? MainController.signal
            : undefined;

        across(type, (t) => {
            target.addEventListener(t, handler, {
                ...options,
                signal
            });
        });
    }

    function remove({
        target = document,
        type,
        handler,
        options
    }) {
        across(type, (t) => {
            target.removeEventListener(t, handler, options);
        });
    }

    return Object.freeze({
        listen,
        resume,
        suspend,
        unlisten
    });
})();
