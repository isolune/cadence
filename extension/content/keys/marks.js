"use strict";

(function() {
    function deleteMark() {
        onKey((key, marks) => {
            delete marks[key];

            browser.storage.local.set({
                marks
            });
        });
    }

    function goMark({
        newTab = false
    } = {}) {
        onKey((key, marks) => {
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
        });
    }

    function onKey(fn) {
        Keys.addLayer({
            down: (key) => {
                if (key === "Shift") {
                    return Keys.BLOCK;
                } else if (key.length !== 1) {
                    return Keys.DONE;
                }

                browser.storage.local.get("marks").then(({
                    marks = {}
                }) => {
                    fn(key, marks);
                });

                return Keys.BLOCK | Keys.DONE;
            }
        });
    }

    function makeMark() {
        onKey((key, marks) => {
            marks[key] = window.location.href;

            browser.storage.local.set({
                marks
            });
        });
    }

    Keys.add({
        "`": goMark,
        "m": makeMark,
        "M": deleteMark,
        "~": () => goMark({ newTab: true })
    });
})();
