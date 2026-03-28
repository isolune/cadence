"use strict";

(function() {
    if (typeof Script === "undefined" || typeof Opts === "undefined") {
        return;
    }

    Script.configure(Opts.config);
})();
