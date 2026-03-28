"use strict";

(function() {
    const CLUE_TEMPLATE = Object.freeze({
        target: "@clue",
        targetDetail: {
            query: "a, button",
            backwards: true
        }
    });

    Keys.add({
        "a": () => {
            Keys.addLayer({
                down: (key) => Keys.YIELD | Keys.DONE
            });
        },
        "z": () => {
            Page.click({
                target: "#prev, #previous"
            }) || Page.click({
                ...CLUE_TEMPLATE,
                targetDetail: {
                    ...CLUE_TEMPLATE.targetDetail,
                    clues: Document.clues.prevPage
                }
            });
        },
        "v": () => {
            Page.click({
                target: "#next"
            }) || Page.click({
                ...CLUE_TEMPLATE,
                targetDetail: {
                    ...CLUE_TEMPLATE.targetDetail,
                    clues: Document.clues.nextPage
                }
            });
        },
        "Z": () => Document.simulateKey("ArrowLeft"),
        "V": () => Document.simulateKey("ArrowRight"),
        "X": Page.pressDown,
        "C": Page.pressUp,
        "#": () => {
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
    });
})();
