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

    function listen(spec) {
        const symbol = Symbol(`events.key:${spec.type}`);

        Registry.set(symbol, spec);

        add(spec);

        return symbol;
    }

    function resume() {
        if (active()) {
            return;
        }

        MainController = new AbortController();

        for (const spec of Registry.values()) {
            add(spec);
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
            const spec = Registry.get(s);

            if (spec !== undefined) {
                Registry.delete(s);

                remove(spec);
            }
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
    }) {
        if (!active()) {
            return;
        }

        const signal = MainController.signal;

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
