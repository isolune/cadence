"use strict";

const Page = (function() {
    /// API

    const action = (name, args) => ({
        name,
        args
    });

    function chain(actions, origin = null) {
        let target = origin;

        for (const { name, args } of actions) {
            target = Page[name]({
                target,
                ...args
            });

            if (target === null) {
                break;
            }
        }

        return target;
    }

    /// Actions

    function click({
        params: {
            byHitbox = false,
            simulate = false
        } = {},
        ...selection
    }) {
        const reference = Document.select(selection);

        if (!(reference instanceof Element)) {
            return null;
        }

        let target, point;

        if (byHitbox) {
            point = Document.pointInElement(reference, {
                content: true,
                inViewport: true,
                xRatio: 0.5,
                yRatio: 0.02
            });

            if (point !== null) {
                const {
                    x,
                    y
                } = point;

                target = Document.deepElementFromPoint(x, y)
                    ?? reference;
            } else {
                target = reference;
            }
        } else {
            target = reference;
        }

        if (simulate) {
            Document.simulateClick(target, {
                point
            });
        } else {
            target.click();
        }

        return target;
    }

    function focus(selection) {
        const target = Document.select(selection);

        if (!(target instanceof Element)) {
            return null;
        }

        target.focus();

        return target;
    }

    function interact({
        ...selection
    }) {
        const target = Document.select(selection);

        if (!(target instanceof Element)) {
            return null;
        }

        if (Document.isInputField(target)) {
            chain([
                action("focus"),
                action("setCaret", {
                    params: {
                        impose: false,
                        index: -1
                    }
                })
            ], target);
        } else if (target.tagName === "SELECT") {
            focus({
                target
            });
        } else {
            click({
                target,
                params: {
                    byHitbox: true,
                    simulate: true
                }
            });
        }

        return target;
    }

    function open({
        params: {
            newTab = "no" // no|yes|follow
        } = {},
        ...selection
    }) {
        const target = Document.select(selection);

        if (!(target instanceof Element)) {
            return null;
        }

        const url = target.href ?? target.src;

        if (!url) {
            Document.simulateClick(target);
        } else if (newTab === "yes" || newTab === "follow") {
            Browser.open({
                active: newTab === "follow",
                href: url
            });
        } else if (newTab === "no") {
            window.location.href = url;
        }

        return target;
    }

    function setCaret({
        params: {
            impose = true,
            index,
            range = 0
        } = {},
        ...selection
    }) {
        const target = Document.select(selection);

        if (!(target instanceof Element)) {
            return null;
        }

        if (Document.supportsSelection(target)) {
            if (impose || Document.caretAtOrigin(target)) {
                target.setSelectionRange(index, index + range)
            }
        }

        return target;
    }

    /// Compounds

    function cycleInputs(n) {
        chain([
            action("focus", {
                target: "@role",
                targetDetail: {
                    pick: {
                        inViewport: true,
                        nth: n,
                        relative: true
                    },
                    type: "inputs"
                },
            }),
            action("setCaret", {
                params: {
                    impose: false,
                    index: -1
                }
            })
        ]);
    }

    /// Controls

    function pressDown() {
        if (document.activeElement?.tagName === "SELECT") {
            Document.stepMenu(document.activeElement, 1);
        } else {
            Document.simulateKey("ArrowDown");
        }
    }

    function pressUp() {
        if (document.activeElement?.tagName === "SELECT") {
            Document.stepMenu(document.activeElement, -1);
        } else {
            Document.simulateKey("ArrowUp");
        }
    }

    return Object.freeze({
        // API
        action,
        chain,
        // Actions
        click,
        focus,
        interact,
        open,
        setCaret,
        // Compounds
        cycleInputs,
        // Controls
        pressDown,
        pressUp
    });
})();
