"use strict";

(function() {
    const AXIS = Object.freeze({
        x: "x",
        y: "y"
    });

    const HALF_PAGE_FRAC = 0.45;
    const FAST_SPEED = Object.freeze({
        v0: 5500,
        vLim: 2700,
        D: HALF_PAGE_FRAC,
        beta: 0.55,
        epsilon: 0.07
    });

    const SLOW_SPEED = Object.freeze({
        v0: 90
    });

    const KeyPassthrough = new Set();
    const Key = {};

    let KeyHandle = null;

    const equalsIgnoreCase = (a, b) =>
        a.toUpperCase() === b.toUpperCase();

    const flipped = ({
        direction: {
            sign = 1,
            ...direction
        } = {},
        ...motion
    }) => ({
        direction: {
            sign: -sign,
            ...direction
        },
        ...motion
    });

    function add(key, motion) {
        for (const k of key) {
            Keys.add({
                [k]: () => scroll(k, motion)
            });

            KeyPassthrough.add(k);
        }
    }

    function addPair({
        key: {
            forward: f,
            reverse: r
        },
        motion
    }) {
        add(f, motion);
        add(r, flipped(motion));
    }

    function gateDown(key) {
        if (key === "Shift") {
            reverse();
        } else if (!equalsIgnoreCase(key, Key.curr)) {
            if (KeyPassthrough.has(key)) {
                return;
            }
        }

        return Keys.BLOCK;
    }

    function gateUp(key) {
        if (key === "Shift") {
            reverse();
        } else if (equalsIgnoreCase(key, Key.curr)) {
            stop();
        } else {
            return;
        }

        return Keys.BLOCK;
    }

    function hook() {
        KeyHandle ??= Keys.addLayer({
            down: gateDown,
            up: gateUp
        });
    }

    function makeSpeed({
        v0,
        vLim,
        D,
        beta = 1.0,
        epsilon = 0.1
    }) {
        const tau = Math.abs(
            D / ((vLim * Math.pow(Math.log(1 / epsilon), 1 / beta)) +
                 (v0 - vLim) * (1 - epsilon))
        ) * 1000;

        // v(t):
        //  Dt          | travel time to D
        //  v(Dt)       ~ vLim + ((v0 - vLim) * epsilon)
        //  v(Inf)     -> vLim
        return (t) => {
            const decay = Math.exp(-Math.pow(t / tau, beta));

            return vLim + ((v0 - vLim) * decay);
        };
    }

    function pack({
        direction: {
            axis = AXIS.y,
            sign = 1
        } = {},
        speed: {
            v0,
            vLim = v0,
            D = 0,
            ...speed
        }
    }) {
        const d = Math.abs(D) > 1
            ? D
            : D * (axis === AXIS.x
                    ? window.innerWidth
                    : window.innerHeight);

        const v = v0 === vLim || D === 0
            ? sign * v0
            : makeSpeed({
                v0: sign * v0,
                vLim: sign * vLim,
                D: d,
                ...speed
            });

        return {
            [`minD${axis}`]: d,
            [`v${axis}`]: v
        };
    }

    function reverse() {
        Key.motion = flipped(Key.motion);

        Scroller.scroll(pack(Key.motion));
    }

    function scroll(key, motion) {
        if (key === Key.curr) {
            return;
        }

        const params = pack(motion);

        if (key === Key.prev && Scroller.gliding) {
            Scroller.extend(params);
        } else {
            Scroller.scroll(params);

            if (!Scroller.active) {
                return;
            }
        }

        hook();

        Object.assign(Key, {
            curr: key,
            prev: null,
            motion
        });
    }

    function stop() {
        Scroller.stop();
        unhook();

        Object.assign(Key, {
            curr: null,
            prev: Key.curr,
            motion: null
        });
    }

    function unhook() {
        Keys.removeLayer(KeyHandle);
        KeyHandle = null;
    }

    /// Init

    addPair({
        key: {
            forward: "dU",
            reverse: "uD"
        },
        motion: {
            speed: FAST_SPEED
        }
    });

    addPair({
        key: {
            forward: "j",
            reverse: "k"
        },
        motion: {
            speed: SLOW_SPEED
        }
    });

    addPair({
        key: {
            forward: "l",
            reverse: "h"
        },
        motion: {
            direction: {
                axis: AXIS.x
            },
            speed: FAST_SPEED
        }
    });

    Keys.add({
        "n": () => Scroller.scrollBy({ y: HALF_PAGE_FRAC }),
        "p": () => Scroller.scrollBy({ y: -HALF_PAGE_FRAC }),
        "gg": () => Scroller.scrollTop(),
        "G": () => Scroller.scrollBottom()
    });

    KeyPassthrough.add("n");
    KeyPassthrough.add("p");
})();
