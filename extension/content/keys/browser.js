"use strict";

(function() {
    Keys.add({
        "!": Browser.back,
        "@": Browser.forward,
        "E": Browser.tabLast,
        "e": Browser.tabNext,
        "ge": Browser.tabRight,
        "gE": Browser.tabRightmost,
        "gp": Browser.tabPin,
        "gq": Browser.tabLeft,
        "gQ": Browser.tabLeftmost,
        "gu": Browser.tabUnload,
        "Q": Browser.tabFirst,
        "q": Browser.tabPrev,
        "r": Browser.tabReload,
        "R": () => Browser.tabReload({ bypassCache: true }),
        "t": Browser.tabNew,
        "T": Browser.tabRestore,
        "x": Browser.tabClose
    });
})();
