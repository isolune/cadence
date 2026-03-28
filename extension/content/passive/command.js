"use strict";

(function() {
    const HANDLER = Object.freeze({
        "blur-focused": () => Document.blur(),
        "escape": () => { Document.simulateKey("Escape"); Document.blur(); },
        "focus-next-input": () => Page.cycleInputs(1),
        "focus-prev-input": () => Page.cycleInputs(-1)
    });

    browser.runtime.onMessage.addListener(({
        action,
        args
    }) => {
        if (action === "enable") {
            Script.enable(args);
            return;
        }

        if (!Script.active) {
            return;
        }

        HANDLER[action]?.(args);
    });
})();
