"use strict";

(function() {
    const _attachShadow = Element.prototype.attachShadow;

    Element.prototype.attachShadow = function(init) {
        const root = _attachShadow.call(this, init);

        if (init.mode === "open") {
            this.dispatchEvent(new CustomEvent("shadowattached", {
                bubbles: true,
                composed: true
            }));
        }

        return root;
    };
})();
