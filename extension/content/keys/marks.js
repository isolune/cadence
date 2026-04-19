"use strict";

Options.define({
    keys: {
        marks: {
            makeMark: "m",
            goMark: "b"
        },
        marksModifier: {
            newTab: "Alt",
            remove: ";"
        }
    }
});

(function() {
    const ModifierKeys = Object.seal({
        newTab: undefined,
        remove: undefined
    });

    const execute = (fn, key, mod) => {
        browser.storage.local.get("marks").then(({
            marks = {}
        }) => {
            fn(key, marks, {
                mod
            });
        });
    };

    function goMark() {
        const {
            newTab: modifierKey
        } = ModifierKeys;

        onKey((key, marks, {
            mod: newTab
        }) => {
            const url = marks[key];

            if (url === undefined) {
                return;
            }

            if (newTab) {
                Browser.open({
                    active: true,
                    href: url
                });
            } else {
                window.location.href = url;
            }
        }, {
            modifierKey
        });
    }

    function onKey(fn, {
        modifierKey
    } = {}) {
        let mod = false;

        Keys.addLayer({
            down: (key) => {
                if (key === modifierKey) {
                    mod = !mod;
                    return KeyLayer.BLOCK;
                }

                if (key.length === 1) {
                    execute(fn, key, mod);
                }

                return key === "Shift"
                    ? KeyLayer.BLOCK
                    : KeyLayer.BLOCK | KeyLayer.DONE;
            }
        });
    }

    function makeMark() {
        const {
            remove: modifierKey
        } = ModifierKeys;

        onKey((key, marks, {
            mod: remove
        }) => {
            if (remove) {
                delete marks[key];
            } else {
                marks[key] = window.location.href;
            }

            browser.storage.local.set({
                marks
            });
        }, {
            modifierKey
        });
    }

    Script.configured.then(({
        keys: {
            marks,
            marksModifier
        },
    }) => {
        Keys.addBindings(marks, {
            goMark,
            makeMark
        });

        Object.assign(ModifierKeys, marksModifier);
        Object.freeze(ModifierKeys);
    });
})();
