"use strict";

Options.define({
    keys: {
        page: {
            passKey: "a",
            focusInput: "i",
            prevPage: "z",
            nextPage: "v",
            pressLeft: "Z",
            pressDown: "X",
            pressUp: "C",
            pressRight: "V",
            openImageAtCursor: "#"
        }
    }
});

(function() {
    const CLUE_TEMPLATE = Object.freeze({
        target: "@clue",
        targetDetail: {
            query: "a, button",
            backwards: true
        }
    });

    function nextPage() {
        Page.click({
            target: "#next"
        }) || Page.click({
            ...CLUE_TEMPLATE,
            targetDetail: {
                ...CLUE_TEMPLATE.targetDetail,
                clues: Document.clues.nextPage
            }
        });
    }

    function prevPage() {
        Page.click({
            target: "#prev, #previous"
        }) || Page.click({
            ...CLUE_TEMPLATE,
            targetDetail: {
                ...CLUE_TEMPLATE.targetDetail,
                clues: Document.clues.prevPage
            }
        });
    }

    function openImageAtCursor() {
        Page.open({
            target: "@mouse",
            targetDetail: {
                query: "img"
            },
            params: {
                newTab: "follow"
            }
        });
    }

    Script.configured.then(({
        keys: {
            page
        }
    }) => {
        Keys.addBindings(page, {
            passKey: () => {
                Keys.addLayer({
                    down: () => KeyLayer.DONE,
                    up:   () => KeyLayer.DONE
                });
            },
            focusInput: () => Page.cycleInputs(1),
            prevPage,
            nextPage,
            pressLeft: () => Document.simulateKey("ArrowLeft"),
            pressDown: Page.pressDown,
            pressUp: Page.pressUp,
            pressRight: () => Document.simulateKey("ArrowRight"),
            openImageAtCursor
        });
    });
})();
