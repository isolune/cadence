"use strict";

(function() {
    Keys.add({
        "A": () => {
            Page.click({
                target: "#link-iv-embed"
            }) || Page.click({
                target: ".watch-on-invidious > a"
            });
        }
    });
})();
