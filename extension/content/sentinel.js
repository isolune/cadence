"use strict";

(function() {
    if (typeof Script === "undefined" || typeof Options === "undefined") {
        return;
    }

    Script.configure(Options.config);
})();
