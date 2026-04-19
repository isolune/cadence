"use strict";

(function() {
    Options.configure({
        extraSelectors: {
            interactive: [
                ".drop-choices .choice",
                ".dropdown > .selected",
                ".expando-button",
                ".gallery-navigation"
            ]
        }
    });
})();
