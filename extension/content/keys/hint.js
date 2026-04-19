"use strict";

Options.define({
    keys: {
        hint: {
            interact: "f",
            open: "F"
        }
    }
});

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

    Script.configured.then(({
        keys: {
            hint
        }
    }) => {
        Keys.addBindings(hint, {
            interact: () => onInteractive([
                Page.action("interact")
            ]),
            open: () => onInteractive([ // TODO: `onLink/Media/Resource`?
                Page.action("open", {
                    params: {
                        newTab: "yes"
                    }
                })
            ])
        });
    });
})();
