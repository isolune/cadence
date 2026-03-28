"use strict";

Opts.define({
    preventAutoFocus: true
});

(function() {
    if (document.readyState !== "loading") {
        return;
    }

    const USER_INPUT_EVENTS = [
        "keydown",
        "pointerdown",
        "touchstart",
        "wheel"
    ];

    const GuardEvents = [
        Events.listen({
            type: "focus",
            handler: handleAutoFocus,
            options: {
                capture: true
            }
        }),
        Events.listen({
            type: USER_INPUT_EVENTS,
            handler: handleInput,
            options: {
                capture: true
            }
        })
    ];

    let GuardedFocus = null;

    /// Fn

    function restoreFocus() {
        if (GuardedFocus === null) {
            return;
        }

        GuardedFocus.focus();
        GuardedFocus = null;
    }

    function unguard() {
        Events.unlisten(GuardEvents);
    }

    /// Event

    function handleAutoFocus(event) {
        const target = event.composedPath()[0];

        if (target.nodeType !== Node.ELEMENT_NODE) {
            return;
        }

        GuardedFocus = target;
        target.blur();
    }

    function handleInput(event) {
        GuardedFocus = null;
        unguard();
    }

    /// Init

    Script.configured.then(({
        preventAutoFocus
    }) => {
        const cleanup = () => {
            restoreFocus();
            unguard();
        };

        if (preventAutoFocus) {
            Script.blocked.then(cleanup);
        } else {
            cleanup();
        }
    });
})();
