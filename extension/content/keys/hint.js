"use strict";

(function() {
    function goAhead() {
        if (Tracker.busy) {
            return Tracker.settle()
                .then(() => true).catch(() => false);
        }

        if (Hints.active) {
            return false;
        }

        return true;
    }

    async function onImage(actions) {
        if (!await goAhead()) {
            return;
        }

        Hints.start({
            selection: {
                target: "@role",
                targetDetail: {
                    pick: {
                        inViewport: true
                    },
                    type: "images"
                }
            },
            options: {
                actions,
                theme: Hints.theme.charcoal
            }
        });
    }

    async function onInteractive(actions) {
        if (!await goAhead()) {
            return;
        }

        Hints.start({
            selection: {
                target: "@role",
                targetDetail: {
                    pick: {
                        inViewport: true
                    },
                    type: "interactive"
                }
            },
            options: {
                actions
            }
        });
    }

    Keys.add({
        f: () => onInteractive([
            Page.action("interact")
        ]),
        F: () => onInteractive([
            Page.action("open", {
                params: {
                    newTab: "yes"
                }
            })
        ]),
        i: () => onImage([ // TODO: Provisional
            Page.action("click", {
                params: {
                    simulate: true
                }
            })
        ]),
        I: () => onImage([ // TODO: Provisional
            Page.action("open", {
                params: {
                    newTab: "follow"
                }
            })
        ])
    });
})();
