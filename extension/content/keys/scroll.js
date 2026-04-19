"use strict";

Options.define({
    keys: {
        scroll: {
            top: "gg",
            bottom: "G",
            up: "p",
            down: "n"
        },
        scrollContinuous: {
            left: "h",
            downFast: "dU",
            downSlow: "j",
            upFast: "uD",
            upSlow: "k",
            right: "l"
        }
    }
});

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

    const Key = {};
    const KeyPassthrough = new Set();

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

        return KeyLayer.BLOCK;
    }

    function gateUp(key) {
        if (key === "Shift") {
            reverse();
        } else if (equalsIgnoreCase(key, Key.curr)) {
            stop();
        } else {
            return;
        }

        return KeyLayer.BLOCK;
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

        if (key === Key.prev && Scroller.coasting) {
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

    Script.configured.then(({
        keys: {
            scroll,
            scrollContinuous: {
                left,
                downFast,
                downSlow,
                upFast,
                upSlow,
                right
            }
        }
    }) => {
        const {
            up,
            down
        } = scroll;

        addPair({
            key: {
                forward: downFast,
                reverse: upFast
            },
            motion: {
                speed: FAST_SPEED
            }
        });

        addPair({
            key: {
                forward: downSlow,
                reverse: upSlow
            },
            motion: {
                speed: SLOW_SPEED
            }
        });

        addPair({
            key: {
                forward: right,
                reverse: left
            },
            motion: {
                direction: {
                    axis: AXIS.x
                },
                speed: SLOW_SPEED
            }
        });

        Keys.addBindings(scroll, {
            top: () => Scroller.scrollTop(),
            bottom: () => Scroller.scrollBottom(),
            up: () => Scroller.scrollBy({ y: -HALF_PAGE_FRAC }),
            down: () => Scroller.scrollBy({ y: HALF_PAGE_FRAC })
        });

        KeyPassthrough.add(up);
        KeyPassthrough.add(down);
    });
})();
