"use strict";

const Script = (function() {
    const STATE = Object.freeze({
        active: "active",
        blocked: "blocked",
        init: "init",
        suspended: "suspended"
    });

    const Lifecycle = {
        resume: [],
        suspend: []
    };

    const {
        promise: blocked,
        resolve: block,
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
            } else if (State === STATE.suspended) {
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

    function onResume(fn) {
        Lifecycle.resume.push(fn);
    }

    function onSuspend(fn) {
        Lifecycle.suspend.push(fn);
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
        }

        Events.resume();

        for (const fn of Lifecycle.resume) {
            fn();
        }

        State = STATE.active;
    }

    function suspend() {
        if (State !== STATE.active) {
            return;
        }

        Events.suspend();

        for (const fn of Lifecycle.suspend) {
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
        primeRun: document.readyState === "loading",
        ready
    });
})();
