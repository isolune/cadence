"use strict";

const KeyLayer = Object.freeze({
    BLOCK: 1 << 0,
    DONE: 1 << 1,
    NEXT: 1 << 2,
    YIELD: 1 << 3
});

const Keys = (function() {
    const {
        NONCE: PREFIX
    } = Environment;

    const Layers = Object.seal({
        keydown: [],
        keyup: []
    });

    const Lookup = {};

    let Sequence = "";

    /// Public

    function add(keys) {
        for (const [seq, fn] of Object.entries(keys)) {
            if (seq === "") {
                continue;
            }

            for (let i = 1; i < seq.length; i++) {
                Lookup[seq.substring(0, i)] = PREFIX;
            }

            Lookup[seq] = fn;
        }
    }

    function addBindings(bindings, methods) {
        const keys = {};

        for (const [name, key] of Object.entries(bindings)) {
            const fn = methods[name];

            if (typeof fn !== "function") {
                throw new StartupError(`Could not resolve binding: '${key}:${name}'`);
            }

            keys[key] = fn;
        }

        Keys.add(keys);
    }

    function addLayer({
        down = null,
        up = null
    }) {
        const handle = Symbol("keys.handle");

        if (typeof down === "function") {
            Layers.keydown.push({
                cb: down,
                handle
            });
        }

        if (typeof up === "function") {
            Layers.keyup.push({
                cb: up,
                handle
            });
        }

        return handle;
    }

    function clear() {
        const cleared = Sequence.length > 0;

        Sequence = "";

        return cleared;
    }

    function press(key) {
        const result = Lookup[Sequence + key];

        if (result === undefined) {
            return clear();
        }

        if (result === PREFIX) {
            Sequence += key;
        } else {
            Sequence = "";
            result();
        }

        return true;
    }

    function removeLayer(handle) {
        for (const type of ["keydown", "keyup"]) {
            Layers[type] = Layers[type].filter(
                (entry) => entry.handle !== handle
            );
        }
    }

    /// Private

    function tryEscape(event) {
        if (event.key !== "Escape") {
            return false;
        }

        Document.blur();

        return true;
    }

    function tryLayers(event) {
        const layers = Layers[event.type];

        for (let i = 0; i < layers.length; i++) {
            const response = layers[i].cb(event.key) ?? KeyLayer.NEXT

            if (response & KeyLayer.DONE)  layers.splice(i--, 1);
            if (response & KeyLayer.NEXT)  continue;
            if (response & KeyLayer.YIELD) return true; // Yield to page
            if (response & KeyLayer.BLOCK) Events.halt(event);

            return true;
        }

        return false;
    }

    function shouldIgnore(event) {
        return (
            event.altKey || event.ctrlKey || event.metaKey ||
            event.repeat ||
            event.key.length > 1
        );
    }

    /// Event

    function handleFocus(event) {
        clear();
    }

    function handleKeyDown(event) {
        if (Document.inputIsFocused) {
            if (tryEscape(event)) {
                Events.halt(event);
            }
        } else if (tryLayers(event)) {
            return;
        } else if (shouldIgnore(event)) {
            if (event.key !== "Shift") {
                clear();
            }
        } else if (press(event.key)) {
            Events.halt(event);
        }
    }

    function handleKeyUp(event) {
        if (Document.inputIsFocused) {
            return;
        } else if (tryLayers(event)) {
            return;
        }
    }

    /// Init

    Events.define({
        type: "focus",
        handler: handleFocus,
        options: {
            capture: true
        }
    });

    Events.define({
        target: window,
        type: "keydown",
        handler: handleKeyDown,
        options: {
            capture: true
        }
    });

    Events.define({
        target: window,
        type: "keyup",
        handler: handleKeyUp,
        options: {
            capture: true
        }
    });

    return Object.freeze({
        add,
        addBindings,
        addLayer,
        clear,
        press,
        removeLayer
    });
})();
