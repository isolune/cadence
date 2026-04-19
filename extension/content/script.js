"use strict";

const Script = (function() {
    const STATE = Object.freeze({
        active: "active",
        blocked: "blocked",
        init: "init",
        suspended: "suspended"
    });

    const StateChangeCallbacks = Object.freeze({
        [STATE.active]: {
            list: [],
            expires: STATE.blocked
        },
        [STATE.blocked]: {
            list: [],
            expires: STATE.blocked
        },
        [STATE.suspended]: {
            list: []
        }
    });

    const { // TODO: Provisional
        promise: configured,
        resolve: configure
    } = Promise.withResolvers();

    let State = STATE.init;

    /// Public

    function enable(enabled) {
        if (enabled) {
            if (State === STATE.init) {
                begin();
            } else if (State !== STATE.active) {
                resume();
            }
        } else {
            if (State === STATE.init) {
                block();
            } else if (State === STATE.active) {
                suspend();
            }
        }
    }

    function ifBlocked(fn) {
        onStateChanged(STATE.blocked, fn);
    }

    function onActive(fn) {
        onStateChanged(STATE.active, fn);
    }

    function onSuspended(fn) {
        onStateChanged(STATE.suspended, fn);
    }

    /// Private

    async function begin() {
        if (State !== STATE.init) {
            return;
        }

        changeState(STATE.active, {
            init: true,
            primeRun: true
        });
    }

    function block() {
        if (State !== STATE.init) {
            return;
        }

        changeState(STATE.blocked);
    }

    function changeState(state, description) {
        const {
            list,
            expires: expiredState
        } = StateChangeCallbacks[state];

        State = state;

        for (const fn of list) {
            fn(description);
        }

        if (expiredState === undefined) {
            return;
        }

        const {
            list: expired
        } = StateChangeCallbacks[expiredState];

        expired.length = 0;
    }

    function onStateChanged(state, fn) {
        const {
            list
        } = StateChangeCallbacks[state];

        list.push(fn);
    }

    function resume() {
        if (State !== STATE.blocked && State !== STATE.suspended) {
            return;
        }

        changeState(STATE.active, {
            init: State === STATE.blocked,
            primeRun: false
        });
    }

    function suspend() {
        if (State !== STATE.active) {
            return;
        }

        changeState(STATE.suspended);
    }

    /// Event

    function handlePageShow(event) {
        if (!event.persisted) {
            return;
        }

        browser.runtime.sendMessage({
            action: "sync"
        });
    }

    /// Init

    browser.runtime.sendMessage({
        action: "handshake"
    });

    window.addEventListener("pageshow", handlePageShow);

    return Object.freeze({
        get active() {
            return State === STATE.active;
        },
        configure,
        configured,
        enable,
        ifBlocked,
        onActive,
        onSuspended
    });
})();
