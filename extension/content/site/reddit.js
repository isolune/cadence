"use strict";

(function() {
    Opts.configure({
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
