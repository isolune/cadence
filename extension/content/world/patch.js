"use strict";

(function() {
    const _attachShadow = Element.prototype.attachShadow;

    Element.prototype.attachShadow = function(options) {
        const root = _attachShadow.call(this, options);

        if (options.mode === "open") {
            this.dispatchEvent(new CustomEvent("shadowattached", {
                bubbles: true,
                composed: true
            }));
        }

        return root;
    };
})();
