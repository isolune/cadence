"use strict";

Opts.define({
    extraClues: {
        nextPage: [],
        prevPage: [],
    },
    extraSelectors: {
        input: [],
        interactive: [],
        nonInteractive: []
    }
});

const Document = (function() {
    const ATTRIBUTES = Object.freeze({
        interactive: [
            "aria-disabled",
            "contenteditable",
            "disabled",
            "hidden",
            "inert",
            "readonly",
            "role",
            "tabindex"
        ]
    });

    const CLUES = {
        nextPage: [
            ">",
            "mais",
            "next",
            "próxima",
            "próximo",
            "次の"
        ],
        prevPage: [
            "<",
            "anterior",
            "prev",
            "previous",
            "前の"
        ]
    };

    const FILTER = Object.freeze({
        boxGenerating: {
            acceptNode(element) {
                return element.checkVisibility()
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_SKIP;
            }
        }
    });

    const INPUT_TYPES = Object.freeze({
        selectable: [
            "password",
            "search",
            "tel",
            "text",
            "url"
        ],
        text: [
            "date",
            "datetime-local",
            "email",
            "month",
            "number",
            "password",
            "search",
            "tel",
            "text",
            "time",
            "url",
            "week"
        ]
    });

    const SELECTORS = Object.freeze({
        input: [
            "textarea:not([readonly])",
            "[contenteditable]:not([contenteditable='false'])",
            "[role='searchbox']",
            "[role='textbox']"
        ],
        interactive: [
            "a",
            "audio",
            "body > img",
            "button",
            "input:not([readonly])",
            "details > summary:first-of-type",
            "label",
            "select",
            "video",
            "[role='button']",
            "[role='tab']",
            "[role='treeitem']",
            "[tabindex]:not([tabindex^='-'])"
        ],
        nonInteractive: [
            "[hidden]",
            "[inert]",
            ":disabled",
            "[aria-disabled='true']",
            "[aria-hidden='true']"
        ],
    });

    const TAGS = Object.freeze({
        nonAtomic: [
            "A",
            "ABBR",
            "B",
            "CITE",
            "CODE",
            "DEL",
            "EM",
            "I",
            "INS",
            "KBD",
            "LABEL",
            "MARK",
            "Q",
            "SPAN",
            "STRONG",
            "TIME",
            "U"
        ]
    });

    const ComposedQuery = {
        input: "",
        interactive: ""
    };

    let FocusedInput = null;

    let MouseX = 0;
    let MouseY = 0;

    const boxInsets = (element) => {
        const cs = window.getComputedStyle(element);

        return {
            bl: parseFloat(cs.borderLeftWidth),
            br: parseFloat(cs.borderRightWidth),
            bt: parseFloat(cs.borderTopWidth),
            bb: parseFloat(cs.borderBottomWidth),
            pl: parseFloat(cs.paddingLeft),
            pr: parseFloat(cs.paddingRight),
            pt: parseFloat(cs.paddingTop),
            pb: parseFloat(cs.paddingBottom)
        };
    };

    const boxRects = (element) =>
        isAtomic(element)
            ? [element.getBoundingClientRect()]
            : element.getClientRects();

    const byIntraDomOrder = (a, b) => // Don't supply disconnected
        a === b
            ? 0
            : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_PRECEDING
                ? 1
                : -1;

    const toArea = ({
        x,
        y,
        width,
        height
    }) => ({
        x,
        y,
        w: width,
        h: height
    });

    const viewportArea = () => ({
        x: 0,
        y: 0,
        w: window.innerWidth,
        h: window.innerHeight
    });

    const dom = document.readyState === "loading"
        ? new Promise((r) => {
            document.addEventListener("DOMContentLoaded", r, {
                once: true
            })})
        : Promise.resolve();

    /// Public

    function blur() {
        document.body.insertAdjacentHTML("beforeend",
            `<span style="opacity: 0; position: fixed;" tabindex="-1"></span>`
        );

        const sink = document.body.lastElementChild;

        sink.click();
        sink.focus({
            preventScroll: true
        });

        sink.remove();
    }

    function caretAtOrigin(element) {
        return !(element.selectionStart > 0 || element.selectionEnd > 0);
    }

    function containsPoint(element, px, py) {
        const {
            x,
            y,
            w,
            h
        } = toArea(element.getBoundingClientRect());

        return (
            x <= px && px <= x + w &&
            y <= py && py <= y + h
        );
    }

    function deepActiveElement(root = document) {
        let element = root.activeElement;

        if (element !== null && element.shadowRoot !== null) {
            return deepActiveElement(element.shadowRoot) ?? element;
        }

        return element;
    }

    function deepElementFromPoint(x, y, root = document) {
        const element = root.elementFromPoint(x, y);

        if (element !== null && element.shadowRoot !== null) {
            return deepElementFromPoint(x, y, element.shadowRoot) ?? element;
        }

        return element;
    }

    function* deepElementsFromPoint(x, y, root = document) {
        const elements = root.elementsFromPoint(x, y);

        for (const element of elements) {
            if (element.shadowRoot !== null) {
                yield* deepElementsFromPoint(x, y, element.shadowRoot);
            }

            yield element;
        }
    }

    function domDepth(element) {
        let d = -1;

        for (let next = element; next != null && next !== document; d++) {
            next = next.parentNode ?? next.host;
        }

        return d;
    }

    function firstBoxArea(element, {
        content = false
    } = {}) {
        const box = firstBoxGeneratingElement(element);

        if (box === null) {
            return null;
        }

        const rects = boxRects(box);

        if (!content) {
            return toArea(rects[0]);
        }

        const {
            bl, br, bt, bb,
            pl, pr, pt, pb
        } = boxInsets(box);

        for (let i = 0; i < rects.length; i++) {
            const {
                x,
                y,
                width: w,
                height: h
            } = rects[i];

            const insetL = i === 0 ? bl + pl : 0;
            const insetR = i === rects.length - 1 ? br + pr : 0;

            if (insetL + insetR >= w) {
                continue;
            }

            return {
                x: x + insetL,
                y: y + bt + pt,
                w: w - insetL - insetR,
                h: h - bt - pt - bb - pb
            };
        }

        return null;
    }

    function firstBoxGeneratingElement(element) {
        if (element.checkVisibility()) {
            return element;
        }

        return document.createTreeWalker(
            element,
            NodeFilter.SHOW_ELEMENT,
            FILTER.boxGenerating
        ).nextNode();
    }

    function isAtomic(element) {
        return (
            element.firstChild === null ||
            !TAGS.nonAtomic.includes(element.tagName)
        );
    }

    function isInputField(element) {
        if (element.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }

        return element.matches(ComposedQuery.input);
    }

    function isInViewport(element) {
        const area = toArea(element.getBoundingClientRect());

        return intersecting(area, viewportArea());
    }

    function isOpaque(element) { // TODO: Retire
        return !element.checkVisibility() || element.checkVisibility({
            opacityProperty: true,
            visibilityProperty: true
        });
    }

    function ordered(element, other) {
        return byIntraDomOrder(element, other) !== 1;
    }

    function pointInElement(element, {
        content = false,
        inViewport = false,
        inset = 0,
        xRatio = inset,
        yRatio = inset
    } = {}) {
        let area = firstBoxArea(element, {
            content
        });

        if (area === null) {
            return null;
        }

        if (inViewport) {
            area = intersect(area, viewportArea());
        }

        if (area === null) {
            return null;
        }

        const {
            x,
            y,
            w,
            h
        } = area;

        return {
            x: Math.round(x + (w * xRatio)),
            y: Math.round(y + (h * yRatio))
        };
    }

    function select({
        target,
        targetDetail = {},
    }) {
        if (target instanceof Element) {
            return target;
        }

        switch (target) {
            case "@clue":
                return queryClue(targetDetail);
            case "@mouse":
                return queryMouse(targetDetail);
            case "@role":
                return queryRole(targetDetail);
            default:
                return deepQuery(target);
        }
    }

    function simulateClick(target, {
        point = pointInElement(target, {
            inset: 0.5
        })
    } = {}) {
        if (point === null) {
            return;
        }

        const eventOptions = {
            button: 0,
            clientX: point.x,
            clientY: point.y,
            bubbles: true,
            cancelable: true,
            composed: true
        };

        const mouseEventOptions = {
            ...eventOptions,
            detail: 1
        };

        const pointerEventOptions = {
            ...eventOptions,
            isPrimary: true,
            pointerId: 1,
            pointerType: "mouse"
        };

        simulateMouseEnter(target);

        target.dispatchEvent(new PointerEvent("pointerdown", {
            ...pointerEventOptions,
            pressure: 0.5
        }));

        target.dispatchEvent(new MouseEvent("mousedown", mouseEventOptions));
        target.dispatchEvent(new PointerEvent("pointerup", pointerEventOptions));
        target.dispatchEvent(new MouseEvent("mouseup", mouseEventOptions));
        target.dispatchEvent(new MouseEvent("click", mouseEventOptions));
    }

    function simulateKey(key) {
        const eventOptions = {
            key,
            keyCode: toKeyCode(key),
            bubbles: true,
            cancelable: true,
            composed: true
        };

        Keys.addLayer({
            down: (k) => k === key ? Keys.DONE : Keys.NEXT,
            up:   (k) => k === key ? Keys.DONE : Keys.NEXT
        });

        document.activeElement.dispatchEvent(new KeyboardEvent("keydown", eventOptions));
        document.activeElement.dispatchEvent(new KeyboardEvent("keyup", eventOptions));
    }

    function simulateMouseEnter(target) {
        target.dispatchEvent(new MouseEvent("mouseover", {
            bubbles: true, composed: true
        }));

        target.dispatchEvent(new MouseEvent("mouseenter", {
            composed: true
        }));
    }

    function stepMenu(menu, n) {
        if (menu.tagName !== "SELECT") {
            return;
        }

        const {
            options: {
                length
            },
            selectedIndex: i
        } = menu;

        const next = Math.max(0, Math.min(i + n, length - 1));

        if (i === next) {
            return;
        }

        menu.selectedIndex = next;
        menu.dispatchEvent(new Event("change", {
            bubbles: true
        }));
    }

    function supportsSelection(element) {
        switch (element.tagName) {
            case "INPUT":
                return INPUT_TYPES.selectable.includes(element.type);
            case "TEXTAREA":
                return true;
        }

        return false;
    }

    function toKeyCode(key) {
        return {
            "Backspace": 8,
            "Enter": 13,
            "Escape": 27,
            "ArrowLeft": 37,
            "ArrowUp": 38,
            "ArrowRight": 39,
            "ArrowDown": 40
        }[key] ?? key.toUpperCase().charCodeAt(0);
    }

    function treeTops(elements) {
        const trees = [];

        elements.sort(byIntraDomOrder);

        for (const element of elements) {
            const tree = trees[trees.length - 1];

            if (tree !== undefined && tree.contains(element)) {
                continue;
            }

            trees.push(element);
        }

        return trees;
    }

    /// Private

    function deepQuery(query) {
        for (const result of deepQueryAll(query)) {
            return result;
        }

        return null;
    }

    function* deepQueryAll(query) { // => DOM order
        const queues = [];
        const roots = Array.from(Tracker.roots)
            .sort(byIntraDomOrder);

        let q = 0;
        let r = 0;

        while (q >= 0) {
            while (queues.length <= q + 1 && r < roots.length) {
                const elements = roots[r].querySelectorAll(query);

                r++;

                if (elements.length === 0) {
                    continue;
                }

                queues.push({
                    elements,
                    i: 0
                });
            }

            const queue = queues[q];

            if (queue === undefined) {
                break; // => No results
            }

            const nextHead = queues[q + 1]?.elements[0];

            while (true) {
                const element = queue.elements[queue.i];

                if (nextHead !== undefined) {
                    if (!ordered(element, nextHead)) {
                        q++;
                        break;
                    }
                }

                yield element;

                queue.i++;

                if (queue.i === queue.elements.length) {
                    queue.elements = null;

                    if (nextHead === undefined) {
                        for (; q >= 0 && queues[q].elements === null; q--) {
                            queues.pop();
                        }
                    } else {
                        q++;
                    }

                    break;
                }
            }
        }
    }

    function imageElements({
        inViewport = false
    } = {}) {
        const images = Array.from(deepQueryAll("img"));

        if (inViewport) {
            return images.filter(isInViewport);
        }

        return images;
    }

    function inputElements({
        inViewport = false,
        relative = false,
        nth = relative ? 0 : undefined
    } = {}) {
        const inputs = interactiveElements({
            inViewport
        }).filter(isInputField);

        if (nth === undefined) {
            return inputs;
        }

        sortByViewportOrder(inputs);

        const posmod = (x, n) => x - (n * Math.floor(x / n));

        let i;

        if (relative) {
            const curr = inputs.indexOf(deepActiveElement());

            i = curr === -1 ? (nth > 0 ? -1 : 0) : curr;
        } else {
            i = 0;
        }

        return inputs[posmod(i + nth, inputs.length)];
    }

    function interactiveElements({
        inViewport = false
    } = {}) {
        if (inViewport) {
            return Array.from(Tracker.interactablesInViewport)
                .filter(isOpaque);
        }

        return Array.from(Tracker.interactables);
    }

    function intersect(a, b) {
        if (!intersecting(a, b)) {
            return null;
        }

        const x = Math.max(a.x, b.x);
        const y = Math.max(a.y, b.y);

        return {
            x,
            y,
            w: Math.min(a.x + a.w, b.x + b.w) - x,
            h: Math.min(a.y + a.h, b.y + b.h) - y
        };
    }

    function intersecting(a, b) {
        return (
            a.x <= b.x + b.w &&
            a.y <= b.y + b.h &&
            b.x <= a.x + a.w &&
            b.y <= a.y + a.h
        );
    }

    function queryClue({
        clues,
        query,
        backwards = false,
        minFit = 0.2
    }) {
        const computeFit = (clue, text) => {
            const index = text.indexOf(clue);

            if (index === -1) {
                return 0.0;
            }

            const coverage = clue.length / text.length;
            const position = index / text.length;

            return coverage * (1 - position);
        };

        const candidates = Array.from(deepQueryAll(query))
            .filter((candidate) => candidate.checkVisibility());

        if (backwards) {
            candidates.reverse();
        }

        let best = null;
        let bestFit = minFit;

        for (const candidate of candidates) {
            const text = candidate.textContent
                .trim()
                .toLowerCase();

            for (const clue of clues) {
                const fit = computeFit(clue, text);

                if (fit === 1.0) {
                    return candidate;
                }

                if (fit > bestFit) {
                    best = candidate;
                    bestFit = fit;
                }
            }
        }

        return best;
    }

    function queryMouse({
        query = "img"
    }) {
        const hovered = Array.from(deepElementsFromPoint(MouseX, MouseY));
        const queried = Array.from(deepQueryAll(query))
            .filter((Q) => containsPoint(Q, MouseX, MouseY));

        let h = 0;
        let q = queried.length - 1;

        while (h < hovered.length && q >= 0) {
            const H = hovered[h];
            const Q = queried[q];

            if (H.contains(Q)) {
                let deepest = Q;
                let depth = domDepth(Q);

                for (let r = q - 1; r >= 0; r--) {
                    const R = queried[r];

                    if (!H.contains(R)) {
                        break;
                    }

                    const dr = domDepth(R);

                    if (dr >= depth) { // => First at deepest
                        deepest = R;
                        depth = dr;
                    }
                }

                return deepest;
            }

            if (ordered(H, Q)) {
                q--;
            } else {
                h++;
            }
        }

        return null;
    }

    function queryRole({
        pick = {},
        type
    }) {
        switch (type) {
            case "images":
                return imageElements(pick);
            case "inputs":
                return inputElements(pick);
            case "interactive":
                return interactiveElements(pick);
            case "scrolling":
                return scrollingElement();
            default:
                return [];
        }
    }

    function scrollingElement() {
        const {
            innerWidth: ww,
            innerHeight: wh
        } = window;

        const stack = document.elementsFromPoint(ww / 2, wh / 2);

        for (const element of stack.reverse()) {
            const {
                clientHeight: ch,
                scrollHeight: sh
            } = element;

            if (sh - ch <= 0 || ch / wh < 0.5) {
                continue;
            }

            const {
                overflowY: oy
            } = window.getComputedStyle(element);

            if (oy === "clip" || oy === "hidden") {
                continue;
            }

            if (oy === "visible" && element !== document.scrollingElement) {
                continue;
            }

            return element;
        }

        return null;
    }

    function sortByViewportOrder(elements) {
        const rects = new Map(elements.map((element) =>
            [element, element.getBoundingClientRect()]
        ));

        return elements.sort((a, b) => {
            const ra = rects.get(a);
            const rb = rects.get(b);

            return Math.abs(ra.y - rb.y) < 1.0
                ? ra.x - rb.x
                : ra.y - rb.y;
        });
    }

    /// Event

    function handleFocusIn(event) {
        const target = event.composedPath()[0];

        if (!isInputField(target)) {
            return;
        }

        FocusedInput = target;
    }

    function handleFocusOut(event) {
        FocusedInput = null;
    }

    function handleMouseMove(event) {
        MouseX = event.clientX;
        MouseY = event.clientY;
    }

    /// Init

    const queriesReady = Script.configured.then(({
        extraSelectors: {
            input,
            interactive,
            nonInteractive
        }
    }) => {
        const nots = SELECTORS.nonInteractive
            .concat(nonInteractive).join(",");

        ComposedQuery.input = `
            :is(input:is(:not([type]),${
                INPUT_TYPES.text.map((t) => `[type='${t}']`).join(",")
            }),${
                SELECTORS.input.concat(input).join(",")
            }):not(${nots})
        `.trim();

        ComposedQuery.interactive = `
            :is(${
                SELECTORS.interactive.concat(interactive).join(",")
            },${
                SELECTORS.input.join(",")
            }):not(${nots})
        `.trim();

        ComposedQuery.nonInteractive = nots;

        Object.freeze(ComposedQuery);
    });

    Script.configured.then(({
        extraClues: {
            nextPage,
            prevPage
        }
    }) => {
        CLUES.nextPage.push(...nextPage);
        CLUES.prevPage.push(...prevPage);

        Object.freeze(CLUES);
    });

    Promise.all([
        Script.ready,
        queriesReady
    ]).then(() => {
        const checkFocus = () => {
            const activeElement = deepActiveElement();

            if (activeElement === null) {
                return;
            }

            if (!isInputField(activeElement)) {
                return;
            }

            FocusedInput = activeElement;
        };

        checkFocus();

        Events.listen({
            type: "focusin",
            handler: handleFocusIn
        });

        Events.listen({
            type: "focusout",
            handler: handleFocusOut
        });

        Events.listen({
            type: "mousemove",
            handler: handleMouseMove,
            options: {
                capture: true
            }
        });
    });

    return Object.freeze({
        get attributes() {
            return ATTRIBUTES;
        },
        get clues() {
            return CLUES;
        },
        get inputIsFocused() {
            return FocusedInput?.isConnected ?? false;
        },
        get queries() {
            return ComposedQuery;
        },
        blur,
        byIntraDomOrder,
        caretAtOrigin,
        containsPoint,
        deepActiveElement,
        deepElementFromPoint,
        deepElementsFromPoint,
        dom,
        domDepth,
        firstBoxArea,
        firstBoxGeneratingElement,
        isAtomic,
        isInputField,
        isInViewport,
        ordered,
        pointInElement,
        queriesReady,
        select,
        simulateClick,
        simulateKey,
        simulateMouseEnter,
        stepMenu,
        supportsSelection,
        toKeyCode,
        treeTops
    });
})();
