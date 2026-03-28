"use strict";

const Browser = (function() {
    class UnserializablePostError extends Error {
        constructor(action, error) {
            super(`Failed to serialize '${action}' args\n${error}`);
        }
    }

    /// Public

    function back() {
        post("back");
    }

    function debug(...messages) {
        post("debug", messages);
    }

    function error(...messages) {
        post("error", messages);
    }

    function forward() {
        post("forward");
    }

    function log(...messages) {
        post("log", messages);
    }

    function open(args = {}) {
        post("open", args);
    }

    function tabClose() {
        post("tab-close");
    }

    function tabFirst() {
        post("tab-first");
    }

    function tabLast() {
        post("tab-last");
    }

    function tabLeft() {
        post("tab-left");
    }

    function tabLeftmost() {
        post("tab-leftmost");
    }

    function tabNew() {
        post("tab-new");
    }

    function tabNext() {
        post("tab-next");
    }

    function tabPin() {
        post("tab-pin");
    }

    function tabPrev() {
        post("tab-prev");
    }

    function tabReload(args = {}) {
        post("tab-reload", args);
    }

    function tabRestore() {
        post("tab-restore");
    }

    function tabRight() {
        post("tab-right");
    }

    function tabRightmost() {
        post("tab-rightmost");
    }

    function tabUnload() {
        post("tab-unload");
    }

    /// Private

    function post(action, args) {
        try {
            void window.structuredClone(args);
        } catch (error) {
            throw new UnserializablePostError(action, error);
        }

        browser.runtime.sendMessage({
            action,
            args
        });
    }

    return Object.freeze({
        back,
        debug,
        error,
        forward,
        log,
        open,
        tabClose,
        tabFirst,
        tabLast,
        tabLeft,
        tabLeftmost,
        tabNew,
        tabNext,
        tabPin,
        tabPrev,
        tabReload,
        tabRestore,
        tabRight,
        tabRightmost,
        tabUnload
    });
})();
