"use strict";

(function() {
    function toInvidious() {
        const match = window.location.href
            .match(/[?]v=(?<id>[^&]+)/);

        if (match === null) {
            return;
        }

        const {
            id
        } = match.groups;

        window.location.href = `https://yt.xyz/watch?v=${id}`;
    }

    function toggleSubtitles() {
        Page.click({
            target: ".ytp-subtitles-button,.ytmClosedCaptioningButtonButton"
        });
    }

    Keys.add({
        "S": toInvidious,
        "s": toggleSubtitles
    });
})();
