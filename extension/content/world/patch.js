"use strict";

(function() {
    const __WATERMARK__ = Symbol.for("cadence.eoSue7bo.patch");

    if (window.hasOwnProperty(__WATERMARK__)) {
        return;
    }

    const DISPATCH = Object.freeze({
        clickListenerAdded: (target) => dispatch(target, "clicklisteneradded"),
        shadowAttached:     (target) => dispatch(target, "shadowattached")
    });

    const dispatch = (target, type) => {
        target?.dispatchEvent(new CustomEvent(type, {
            bubbles: true, composed: true
        }));
    };

    function parseProperty(prototype, name) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, name);

        if (descriptor === undefined) {
            return null;
        }

        const handle = ["set", "value"]
            .find((key) => key in descriptor);

        return {
            descriptor,
            handle
        };
    }

    function patch({
        constructor,
        name,
        ...args
    }) {
        if (!tryPatch({
            constructor,
            name,
            ...args
        })) {
            console.warn(`Failed patching '${name}' in ${constructor?.name}`);
        }
    }

    function patchAll({
        constructor,
        ...args
    }) {
        constructor.forEach((c) => patch({
            constructor: c,
            ...args
        }));
    }

    function tryPatch({
        constructor,
        name,
        makeFn
    }) {
        if (typeof constructor !== "function") {
            return false;
        }

        const {
            prototype
        } = constructor;

        const parsed = parseProperty(prototype, name);

        if (parsed === null) {
            return false;
        }

        const {
            descriptor,
            handle
        } = parsed;

        const builtin = descriptor[handle];

        if (typeof builtin !== "function") {
            return false;
        }

        const patched = makeFn(builtin, name)[name]

        if (typeof patched !== "function") {
            return false;
        }

        return Reflect.defineProperty(prototype, name, {
            ...descriptor,
            [handle]: patched
        });
    }

    /// Clicks

    patch({
        constructor: Element,
        name: "setAttribute",
        makeFn: (builtin, B) => ({
            [B](name, value) {
                hook: {
                    if (name.toLowerCase() !== "onclick") {
                        break hook;
                    }

                    DISPATCH.clickListenerAdded(this);
                };

                return builtin.call(this, name, value);
            }
        })
    });

    patch({
        constructor: EventTarget,
        name: "addEventListener",
        makeFn: (builtin, B) => ({
            [B](type, listener, options) {
                hook: {
                    if (type !== "click") {
                        break hook;
                    }

                    DISPATCH.clickListenerAdded(this);
                };

                return builtin.call(this, type, listener, options);
            }
        })
    });

    patchAll({
        constructor: [HTMLElement, SVGElement],
        name: "onclick",
        makeFn: (builtin, B) => ({
            [B](value) {
                hook: {
                    if (typeof value !== "function") {
                        break hook;
                    }

                    DISPATCH.clickListenerAdded(this);
                };

                builtin.call(this, value);
            }
        })
    });

    /// Shadows

    patch({
        constructor: Element,
        name: "attachShadow",
        makeFn: (builtin, B) => ({
            [B](options) {
                const shadowRoot = builtin.call(this, options);

                hook: {
                    if (!this.isConnected) {
                        break hook;
                    }

                    if (options.mode !== "open") {
                        break hook;
                    }

                    DISPATCH.shadowAttached(this);
                };

                return shadowRoot;
            }
        })
    });

    window[__WATERMARK__] = true;
})();
