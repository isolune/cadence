"use strict";

const Keys = (function() {
    const {
        NONCE: PREFIX
    } = Environment;

    const BLOCK = 1 << 0;
    const DONE = 1 << 1;
    const NEXT = 1 << 2;
    const YIELD = 1 << 3;

    const Layers = {
        keydown: [],
        keyup: []
    };

    const Lookup = {};

    let Sequence = "";

    /// Public

    function add(keys) {
        for (const [seq, fn] of Object.entries(keys)) {
            for (let i = 1; i < seq.length; i++) {
                Lookup[seq.substring(0, i)] = PREFIX;
            }

            Lookup[seq] = fn;
        }
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

        if (result !== undefined) {
            Sequence += key;

            if (result === PREFIX) {
                return true;
            } else {
                result();
            }
        }

        return clear();
    }

    function removeLayer(handle) {
        for (const type of ["keydown", "keyup"]) {
            Layers[type] = Layers[type].filter(
                (entry) => entry.handle !== handle
            );
        }
    }

    /// Private

    function delegate(event) {
        const layers = Layers[event.type];

        for (let i = 0; i < layers.length; i++) {
            const response = layers[i].cb(event.key) ?? NEXT

            if (response & DONE)  layers.splice(i--, 1);
            if (response & NEXT)  continue;
            if (response & YIELD) return true; // Yield to page
            if (response & BLOCK) stopEvent(event);

            return true;
        }

        return false;
    }

    function escape(event) {
        if (event.key === "Escape") {
            Document.blur();

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

    function stopEvent(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
    }

    /// Event

    function handleFocus(event) {
        clear();
    }

    function handleKeyDown(event) {
        if (Document.inputIsFocused) {
            if (escape(event)) {
                stopEvent(event);
            }
        } else if (delegate(event)) {
            return;
        } else if (shouldIgnore(event)) {
            if (event.key !== "Shift") {
                clear();
            }
        } else if (press(event.key)) {
            stopEvent(event);
        }
    }

    function handleKeyUp(event) {
        if (Document.inputIsFocused) {
            return;
        } else if (delegate(event)) {
            return;
        }
    }

    Script.ready.then(() => {
        Events.listen({
            type: "focus",
            handler: handleFocus,
            options: {
                capture: true
            }
        });

        Events.listen({
            type: "keydown",
            handler: handleKeyDown,
            options: {
                capture: true
            }
        });

        Events.listen({
            type: "keyup",
            handler: handleKeyUp,
            options: {
                capture: true
            }
        });
    });

    return Object.freeze({
        BLOCK,
        DONE,
        NEXT,
        YIELD,
        addLayer,
        removeLayer,
        add,
        clear,
        press,
        stop
    });
})();
