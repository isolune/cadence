"use strict";

(function() {
    function onImage(actions) {
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

    function onInteractive(actions) {
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
            Page.action("interact", {
                params: {
                    byHitbox: true
                }
            })
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
