"use strict";

const ASSET = Object.freeze({
    css: {
        hints: browser.runtime.getURL("asset/css/hints.css")
    },
    font: {
        jetbrainsMono: browser.runtime.getURL("asset/font/jetbrains-mono.woff2")
    }
});
