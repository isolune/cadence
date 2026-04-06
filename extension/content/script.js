"use strict";

const Script = (function() {
    const STATE = Object.freeze({
        active: "active",
        blocked: "blocked",
        init: "init",
        suspended: "suspended"
    });

    const Routines = {
        resume: [],
        suspend: []
    };

    const {
        promise: blocked,
        resolve: block
    } = Promise.withResolvers();

    const {
        promise: configured,
        resolve: configure
    } = Promise.withResolvers();

    const {
        promise: ready,
        resolve: init
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
                abort();
            } else if (State === STATE.active) {
                suspend();
            }
        }
    }

    function onResume(fn) {
        Routines.resume.push(fn);
    }

    function onSuspend(fn) {
        Routines.suspend.push(fn);
    }

    /// Private

    function abort() {
        if (State !== STATE.init) {
            return;
        }

        Events.suspend();
        block();

        State = STATE.blocked;
    }

    function begin() {
        if (State !== STATE.init) {
            return;
        }

        init();

        State = STATE.active;
    }

    function resume() {
        if (State !== STATE.blocked && State !== STATE.suspended) {
            return;
        }

        if (State === STATE.blocked) {
            init();
        } else {
            for (const fn of Routines.resume) {
                fn();
            }
        }

        Events.resume();

        State = STATE.active;
    }

    function suspend() {
        if (State !== STATE.active) {
            return;
        }

        Events.suspend();

        for (const fn of Routines.suspend) {
            fn();
        }

        State = STATE.suspended;
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
        get state() {
            return State;
        },
        blocked,
        configure,
        configured,
        enable,
        onResume,
        onSuspend,
        ready
    });
})();
