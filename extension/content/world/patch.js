"use strict";

(function() {
    const BUILTIN = Object.freeze({
        attachShadow: Element.prototype.attachShadow
    });

    const emitShadowAttached = (target) =>
        target.dispatchEvent(new CustomEvent("shadowattached", {
            bubbles: true, composed: true
        }));

    Element.prototype.attachShadow = function(options) {
        const root = BUILTIN.attachShadow.call(this, options);

        hook: {
            if (options.mode !== "open") {
                break hook;
            }

            emitShadowAttached(this);
        };

        return root;
    };
})();
