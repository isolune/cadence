"use strict";

(function() {
    const Spoiled = new Set();

    function spoil() {
        const spoilers = [...document.querySelectorAll("s")]
            .filter(Document.isInViewport);

        for (const { style } of spoilers) {
            style.setProperty("color", "white", "important");

            Spoiled.add(style);
        }
    }

    function unspoil() {
        for (const style of Spoiled) {
            style.removeProperty("color");
        }

        Spoiled.clear();
    }

    Keys.addLayer({
        down: (key) => {
            if (key !== "Shift" || Spoiled.size > 0) {
                return;
            }

            spoil();
        },
        up: (key) => {
            if (key !== "Shift" || Spoiled.size === 0) {
                return;
            }

            unspoil();
        }
    });
})();
