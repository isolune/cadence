"use strict";

const Scroller = (function() {
    const DocumentObserver = new ResizeObserver(handleResize);

    let CumulativeDt = 0.0;
    let CumulativeDx = 0.0;
    let CumulativeDy = 0.0;

    let InertiaX = false;
    let InertiaY = false;

    let MinDx = 0;
    let MinDy = 0;

    let ScrollingElement = null;
    let Scrolling = false;

    let StepTimestamp = 0;

    let vx = null;
    let vy = null;

    const toFunc = (v) => {
        if (typeof v === "function") {
            if (Math.sign(v(Number.EPSILON)) === 1) {
                return (t) => Math.max(0, v(t));
            } else {
                return (t) => Math.min(0, v(t));
            }
        }

        return v ? () => v : () => 0;
    };

    /// Public

    function extend({
        minDx = 0,
        minDy = 0
    }) {
        if (!Scrolling) {
            return;
        }

        MinDx += minDx;
        MinDy += minDy;

        InertiaX = false;
        InertiaY = false;
    }

    function scroll({
        minDx = 0,
        minDy = 0,
        vx: vxIn = 0,
        vy: vyIn = 0
    }) {
        if (!ensureElement()) {
            return;
        }

        CumulativeDt = 0.0;
        CumulativeDx = 0.0;
        CumulativeDy = 0.0;

        InertiaX = false;
        InertiaY = false;

        MinDx = minDx;
        MinDy = minDy;

        vx = toFunc(vxIn);
        vy = toFunc(vyIn);

        if (Scrolling) {
            return;
        }

        Scrolling = true;

        window.requestAnimationFrame(scrollStep);
    }

    function scrollBottom() {
        if (!ensureElement()) {
            return;
        }

        ScrollingElement.scrollTo({
            top: ScrollingElement.scrollHeight,
            behavior: "smooth"
        });
    }

    function scrollBy({
        x,
        y
    }) {
        if (!ensureElement()) {
            return;
        }

        const dx = (Math.abs(x) < 1 ? (x * ScrollingElement.clientWidth)  : x);
        const dy = (Math.abs(y) < 1 ? (y * ScrollingElement.clientHeight) : y);

        ScrollingElement.scrollBy({
            left: dx,
            top: dy,
            behavior: "smooth"
        });
    }

    function scrollTo({
        x,
        y
    }) {
        if (!ensureElement()) {
            return;
        }

        ScrollingElement.scrollTo({
            left: x,
            top: y,
            behavior: "smooth"
        });
    }

    function scrollTop() {
        if (!ensureElement()) {
            return;
        }

        ScrollingElement.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    function stop() {
        if (!Scrolling) {
            return;
        }

        if (Math.abs(CumulativeDx) < MinDx) {
            InertiaX = true;
        }

        if (Math.abs(CumulativeDy) < MinDy) {
            InertiaY = true;
        }

        if (!(InertiaX || InertiaY)) {
            stopImmediate();
        }
    }

    function stopImmediate() {
        Scrolling = false;
        StepTimestamp = 0;
    }

    /// Private

    function ensureElement() {
        if (!ScrollingElement?.isConnected) {
            findElement();
        }

        return ScrollingElement !== null;
    }

    function findElement() {
        ScrollingElement = Document.select({
            target: "@role",
            targetDetail: {
                type: "scrolling"
            }
        });
    }

    function followElement() {
        DocumentObserver.observe(document.documentElement);
    }

    function scrollStep(timestamp) {
        if (!Scrolling) {
            return;
        } else if (StepTimestamp === timestamp) {
            return;
        } else if (StepTimestamp === 0) {
            StepTimestamp = timestamp;
        } else {
            const dt = timestamp - StepTimestamp;

            CumulativeDt += dt;

            const tM = CumulativeDt - (dt / 2);

            const floatDx = vx(tM) * (dt / 1000);
            const floatDy = vy(tM) * (dt / 1000);

            if (floatDx === 0 && floatDy === 0) {
                stopImmediate();

                return;
            }

            let dx = Math.trunc(CumulativeDx + floatDx) - Math.trunc(CumulativeDx);
            let dy = Math.trunc(CumulativeDy + floatDy) - Math.trunc(CumulativeDy);

            CumulativeDx += floatDx;
            CumulativeDy += floatDy;

            if (InertiaX && Math.abs(CumulativeDx) >= MinDx) {
                dx -= Math.trunc(CumulativeDx) - (Math.sign(dx) * MinDx);
                InertiaX = false;
                vx = toFunc(0);
            }

            if (InertiaY && Math.abs(CumulativeDy) >= MinDy) {
                dy -= Math.trunc(CumulativeDy) - (Math.sign(dy) * MinDy);
                InertiaY = false;
                vy = toFunc(0);
            }

            ScrollingElement.scrollBy({
                left:     dx,
                top:      dy,
                behavior: "instant"
            });
        }

        StepTimestamp = timestamp;

        window.requestAnimationFrame(scrollStep);
    }

    function stopActivity() {
        stopImmediate();

        DocumentObserver.disconnect();
        ScrollingElement = null;
    }

    /// Event

    function handleResize() {
        if (ScrollingElement !== null) {
            const {
                clientHeight: ch,
                scrollHeight: sh
            } = ScrollingElement;

            if (ch !== sh) {
                return;
            }
        }

        findElement();
    }

    /// Init

    Script.onActive(async () => {
        await Document.dom;

        followElement();
    });

    Script.onSuspended(stopActivity);

    return Object.freeze({
        get active() {
            return Scrolling;
        },
        get coasting() {
            return Scrolling && (InertiaX || InertiaY);
        },
        extend,
        scroll,
        scrollBottom,
        scrollBy,
        scrollTo,
        scrollTop,
        stop,
        stopImmediate
    });
})();
