"use strict";

const EventsFlag = Object.freeze({
    NONE: 0,
    EAGER: 1,
    LAZY: 2
});

const Events = (function() {
    const ActiveListeners = new WeakSet();
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

    function define(spec, {
        managed = true,
        mode = EventsFlag.NONE
    } = {}) {
        const symbol = Symbol(`events.key:${spec.type}`);

        Registry.set(symbol, {
            spec,
            params: {
                managed,
                mode
            }
        });

        if (
            (Script.active && managed && mode !== EventsFlag.LAZY) ||
            mode === EventsFlag.EAGER
        ) {
            add(spec, {
                managed
            });
        }

        return symbol;
    }

    function halt(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    function listen(symbol) {
        across(symbol, (s) => {
            const record = Registry.get(s);

            if (record === undefined) {
                return;
            }

            const {
                spec,
                params: {
                    managed
                }
            } = record;

            add(spec, {
                managed
            });
        });
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

            remove(spec);
        });
    }

    /// Private

    function add(spec, {
        managed
    }) {
        if (ActiveListeners.has(spec)) {
            throw new UnexpectedError(`Added event twice: '${spec.type}'`);
        }

        const {
            target = document,
            type,
            handler,
            options
        } = spec;

        const signal = managed
            ? MainController.signal
            : undefined;

        ActiveListeners.add(spec);

        across(type, (t) => {
            target.addEventListener(t, handler, {
                ...options,
                signal
            });
        });
    }

    function start({
        primeRun
    }) {
        MainController ??= new AbortController();

        for (const { spec, params: { managed, mode } } of Registry.values()) {
            if (
                !managed ||
                (primeRun && mode === EventsFlag.EAGER) ||
                mode === EventsFlag.LAZY
            ) {
                continue;
            }

            add(spec, {
                managed
            });
        }
    }

    function remove(spec) {
        if (!ActiveListeners.delete(spec)) {
            return;
        }

        const {
            target = document,
            type,
            handler,
            options
        } = spec;

        across(type, (t) => {
            target.removeEventListener(t, handler, options);
        });
    }

    function stop() {
        MainController?.abort();
        MainController = null;

        for (const { spec, params: { managed } } of Registry.values()) {
            if (!managed) {
                continue;
            }

            ActiveListeners.delete(spec);
        }
    }

    /// Init

    Script.ifBlocked(stop);

    Script.onActive(start);
    Script.onSuspended(stop);

    return Object.freeze({
        define,
        halt,
        listen,
        unlisten
    });
})();
