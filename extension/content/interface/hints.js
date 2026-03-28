"use strict";

const Hints = (function() {
    const {
        CSS_PREFIX,
        NONCE: PREFIX
    } = Environment;

    const CSS = Object.freeze({
        container: `${CSS_PREFIX}container`,
        body: `${CSS_PREFIX}body`,
        char: `${CSS_PREFIX}char`,
        charSel: `${CSS_PREFIX}charsel`,
        theme: `${CSS_PREFIX}theme-`
    });

    const HOST_ID = `${CSS_PREFIX}hints`;

    const FONT = ASSET.font.jetbrainsMono;
    const STYLESHEET = ASSET.css.hints;

    const THEMES = Object.freeze({
        charcoal: "charcoal",
        default: "default",
        navy: "navy"
    });

    const Items = new Map();
    const RunParams = {};

    let Container = null;
    let Host = null;
    let KeyHandle = null;
    let Progress = "";

    /// Public

    function clear() {
        if (Items.size === 0) {
            return;
        }

        Container.replaceChildren();

        Items.clear();
        Progress = "";

        releaseKeys();
    }

    function start({
        selection,
        options: {
            actions,
            charPool = "awersdft",
            theme = THEMES.default
        }
    }) {
        if (Items.size > 0) {
            clear();
        }

        const built = build({
            charPool,
            items: Document.select(selection),
            theme
        });

        if (!built) {
            return;
        }

        if (!Host.isConnected) {
            placeHost();
        }

        captureKeys();

        Object.assign(RunParams, {
            actions
        });
    }

    /// Load

    function createContainer() {
        const container = document.createElement("div");

        container.className = CSS.container;

        return container;
    }

    function createHost() {
        const host = document.createElement("div");

        document.getElementById(HOST_ID)?.remove();

        host.id = HOST_ID;

        Object.assign(host.style, {
            all: "initial",
            contain: "strict",
            inset: 0,
            pointerEvents: "none",
            position: "fixed",
            zIndex: 2147483647
        });

        return host;
    }

    async function loadFont() {
        if (window.location.protocol === "about:") {
            return;
        }

        const font = new FontFace("JBM", `url("${FONT}") format("woff2")`);
        await font.load();

        document.fonts.add(font);
    }

    function loadStyle() {
        const link = document.createElement("link");

        link.rel = "stylesheet";
        link.href = STYLESHEET;

        return link;
    }

    function placeHost() {
        if (Host?.isConnected) {
            return;
        }

        document.documentElement.appendChild(Host);
    }

    function prepareDocument() {
        if (Host !== null) {
            return;
        }

        Host = createHost();

        const root = Host.attachShadow({
            mode: "closed"
        });

        Container = createContainer();

        root.appendChild(loadStyle());
        root.appendChild(Container);

        loadFont();
    }

    /// Build

    function build({
        charPool,
        items,
        theme
    }) {
        const count = items.length;
        const {
            ids,
            prefixes,
            uniq: uniqPool
        } = generateIds(count, charPool) ?? {};

        if (ids === undefined) {
            return false;
        }

        const spans = {};

        for (const char of uniqPool) {
            spans[char] = `<span class="${CSS.char}">${char}</span>`;
        }

        let html = "";

        for (let i = 0; i < count; i++) {
            const item = items[i];
            const itemArea = Document.firstLayoutArea(item);

            if (itemArea === null) {
                continue;
            }

            const x = Math.max(itemArea.x, 0);
            const y = Math.max(itemArea.y, 0);

            const id = ids[i];

            let contents = "";

            for (const char of id) {
                contents += spans[char];
            }

            html += `<div class="${CSS.body} ${CSS.theme}${theme}" data-id="${id}" style="transform: translate(${x}px, ${y}px);">${contents}</div>`;

            Items.set(id, item);
        }

        if (Items.size === 0) {
            return false;
        }

        for (const prefix of prefixes) {
            Items.set(prefix, PREFIX);
        }

        Container.insertAdjacentHTML("beforeend", html);

        return true;
    }

    function generateIds(n, seq) {
        const uniq = Array.from(new Set(seq)).join("");

        if (uniq.length < 2 && uniq.length < n) {
            return null;
        }

        const ids = [];
        const prefixes = [];
        const queue = Array.from(uniq);

        let ptr = 0;

        while (ids.length < n) {
            if (queue.length === 0) {
                const tail = prefixes[ptr] ?? ids[0];

                for (const char of uniq) {
                    queue.push(char + tail);
                }

                ptr++;
            }

            const id = queue.shift();

            if (id.startsWith(ids[0])) {
                prefixes.push(ids.shift());
            }

            ids.push(id);
        }

        return {
            ids,
            prefixes,
            uniq
        };
    }

    /// Interact

    function actOn(item) {
        Page.chain(RunParams.actions, item);
    }

    function advance() {
        const step = Items.get(Progress);

        if (step === PREFIX) {
            prune();
        } else {
            if (step !== undefined) {
                actOn(step);
            }

            clear();
        }
    }

    function captureKeys() {
        KeyHandle ??= Keys.addLayer({
            down: (key) => {
                if (key === "Tab") {
                    reverse();
                } else {
                    Progress += key;
                    advance();
                }

                return Keys.BLOCK;
            },
            up: () => {
                return Keys.BLOCK;
            }
        });
    }

    function highlightChar(hint, index) {
        hint.children[index].classList.add(CSS.charSel);
    }

    function prune() {
        const index = Progress.length - 1;

        for (let hint = null, next = Container.firstElementChild; next !== null;) {
            hint = next;
            next = hint.nextElementSibling;

            const id = hint.dataset.id;

            if (id.startsWith(Progress)) {
                highlightChar(hint, index);
            } else {
                hint.remove();

                Items.delete(id);
            }
        }
    }

    function releaseKeys() {
        Keys.removeLayer(KeyHandle);
        KeyHandle = null;
    }

    function reverse() {
        const reversed = Array.from(Container.children)
            .reverse();

        Container.append(...reversed);
    }

    /// Event

    function handleScroll() {
        if (Items.size > 0) {
            clear();
        }
    }

    /// Init

    Script.ready.then(() => {
        prepareDocument();

        Document.dom.then(placeHost);

        Events.listen({
            handler: handleScroll,
            type: "scroll",
            options: {
                passive: true
            }
        });
    });

    return Object.freeze({
        get theme() {
            return THEMES;
        },
        clear,
        start
    });
})();
