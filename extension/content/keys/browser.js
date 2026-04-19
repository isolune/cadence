"use strict";

Options.define({
    keys: {
        browser: {
            back: "!",
            forward: "@",
            tabLast: "E",
            tabNext: "e",
            tabRight: "ge",
            tabRightmost: "gE",
            tabPin: "gp",
            tabLeft: "gq",
            tabLeftmost: "gQ",
            tabUnload: "gu",
            tabFirst: "Q",
            tabPrev: "q",
            tabReload: "r",
            tabReloadFull: "R",
            tabNew: "t",
            tabRestore: "T",
            tabClose: "x"
        }
    }
});

(function() {
    Script.configured.then(({
        keys: {
            browser
        }
    }) => {
        Keys.addBindings(browser, Browser);
    });
})();
