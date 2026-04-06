"use strict";

const Tracker = (function() {
    const INTERSECTION_THRESHOLD = 0.05;

    const MUTATION_MAX_SIFT = 50;

    const SHADOW_HOST_BLACKLIST = Object.freeze([
        "ICONIFY-ICON"
    ]);

    const DesignatedInteractables = new WeakSet();
    const InteractablesInViewport = new Set();

    const Roots = new Set();
    const RootMetadata = new WeakMap();

    const ElementToBox = new WeakMap();
    const BoxToElement = new WeakMap();

    const BoxesToSurvey = new Set();

    const Intersections = new IntersectionObserver(handleIntersection, {
        // delay: 100,
        threshold: INTERSECTION_THRESHOLD,
        // trackVisibility: true // TODO: Wait for FF
        // https://caniuse.com/mdn-api_intersectionobserver_trackvisibility
    });

    const PendingPrune = new Set();
    const PendingReview = new Map();
    const PendingScan = new Map();

    const enqueueElement = (pending, root, element) =>
        pending.getOrInsertComputed(root, () => []).push(element);

    const enqueueRoot = (pending, root) =>
        pending.add(root);

    const rootObserver = (root) => {
        const observer = new MutationObserver(handleMutation);

        observer.observe(root, {
            attributes: true,
            attributeFilter: Document.attributes.interactive,
            childList: true,
            subtree: true
        });

        return observer;
    };

    let BoxSurvey = null;
    let FlushJob = null;

    /// Public

    function busy() {
        return FlushJob !== null || BoxesToSurvey.size > 0;
    }

    function settle() {
        if (!busy()) {
            return Promise.resolve();
        }

        if (FlushJob !== null) {
            flush();
        }

        if (BoxesToSurvey.size === 0) {
            closeSurvey();

            return Promise.resolve();
        }

        BoxSurvey ??= Promise.withResolvers();

        return BoxSurvey.promise;
    }

    /// Private

    function abortSurvey() {
        BoxSurvey?.reject();
        BoxSurvey = null;

        BoxesToSurvey.clear();
    }

    function attach(root) {
        if (!root.isConnected) {
            return;
        }

        if (Roots.has(root)) {
            throw new UnexpectedError("Attached root twice");
        }

        const metadata = Object.freeze({
            interactables: new Set(),
            observer: rootObserver(root)
        });

        const {
            interactables
        } = metadata;

        Roots.add(root);
        RootMetadata.set(root, metadata);

        scan(root, interactables);

        return metadata;
    }

    function cancelFlush() {
        window.cancelIdleCallback(FlushJob);

        FlushJob = null;
    }

    function closeSurvey() {
        BoxSurvey?.resolve();
        BoxSurvey = null;
    }

    function designate(element) {
        if (DesignatedInteractables.has(element)) {
            return false;
        }

        DesignatedInteractables.add(element);

        return true;
    }

    function detach(root) {
        const {
            interactables,
            observer
        } = RootMetadata.get(root);

        for (const element of interactables) {
            untrack(element);
        }

        observer.disconnect();

        Roots.delete(root);
        RootMetadata.delete(root);

        for (const pending of [
            PendingPrune,
            PendingReview,
            PendingScan
        ]) {
            pending.delete(root);
        }
    }

    function flush() {
        if (FlushJob === null) {
            return;
        }

        FlushJob = null;

        pruneRemoved();
        scanAdded();
        reviewChanged();
    }

    function isAdoptable(element) {
        return (
            DesignatedInteractables.has(element) &&
            !element.matches(Document.queries.nonInteractive)
        );
    }

    function isIgnorable(shadowRoot) {
        const {
            host: {
                tagName
            }
        } = shadowRoot;

        return SHADOW_HOST_BLACKLIST.includes(tagName);
    }

    function prune(root) {
        const {
            interactables
        } = RootMetadata.get(root);

        for (const element of interactables) {
            if (element.isConnected && root === element.getRootNode()) {
                continue;
            }

            untrack(element, interactables);
        }
    }

    function pruneRemoved() {
        if (PendingPrune.size === 0) {
            return;
        }

        for (const root of Roots) {
            if (root.isConnected) {
                continue;
            }

            detach(root);
        }

        for (const root of PendingPrune) {
            prune(root);
        }

        PendingPrune.clear();
    }

    function requestFlush() {
        FlushJob ??= whenIdle(flush);
    }

    function retire() {
        abortSurvey();
        cancelFlush();

        for (const root of Roots) {
            detach(root);
        }
    }

    function reviewChanged() {
        for (const [root, changed] of PendingReview.entries()) {
            const {
                interactables
            } = RootMetadata.get(root);

            for (const element of changed) {
                if (!element.isConnected) {
                    continue;
                }

                const pass = DesignatedInteractables.has(element)
                    ? !element.matches(Document.queries.nonInteractive)
                    :  element.matches(Document.queries.interactive);

                if (pass) {
                    track(element, interactables);
                } else {
                    untrack(element, interactables);
                }
            }
        }

        PendingReview.clear();
    }

    function scan(node, interactables) {
        const results = node.querySelectorAll(Document.queries.interactive);

        if (
            node.nodeType === Node.ELEMENT_NODE &&
            node.matches(Document.queries.interactive)
        ) {
            track(node, interactables);
        }

        for (const element of results) {
            track(element, interactables);
        }
    }

    function scanAdded() {
        for (const [root, added] of PendingScan.entries()) {
            const {
                interactables
            } = RootMetadata.get(root);

            if (added.length > MUTATION_MAX_SIFT) {
                scan(root, interactables);
            } else {
                const trees = Document.treeTops(
                    added.filter((element) => element.isConnected)
                );

                for (const element of trees) {
                    scan(element, interactables);
                }
            }
        }

        PendingScan.clear();
    }

    function start() {
        if (Roots.size > 0) {
            throw new UnexpectedError("Tracker started in unclean state");
        }

        walk();
    }

    function survey(box) {
        if (BoxesToSurvey.delete(box) && BoxesToSurvey.size === 0) {
            closeSurvey();
        }
    }

    function track(element, interactables) {
        if (interactables.has(element)) {
            return;
        }

        interactables.add(element);

        const box = Document.firstBoxGeneratingElement(element) ?? element;

        if (element !== box) {
            ElementToBox.set(element, box);
            BoxToElement.set(box, element);
        }

        BoxesToSurvey.add(box);
        Intersections.observe(box);
    }

    function untrack(element, interactables = null) {
        if (interactables !== null) {
            if (!interactables.delete(element)) {
                return;
            }
        }

        const box = ElementToBox.get(element) ?? element;

        if (element !== box) {
            ElementToBox.delete(element);
            BoxToElement.delete(box);
        }

        survey(box);

        InteractablesInViewport.delete(element);
        Intersections.unobserve(box);
    }

    function walk(root = document) {
        const {
            interactables
        } = attach(root);

        for (const element of root.querySelectorAll("*")) {
            const {
                shadowRoot
            } = element;

            if (isAdoptable(element)) {
                track(element, interactables);
            }

            if (shadowRoot === null || isIgnorable(shadowRoot)) {
                continue;
            }

            walk(shadowRoot);
        }
    }

    function whenIdle(fn) {
        return window.requestIdleCallback(() => {
            if (!Script.active) {
                return;
            }

            fn();
        });
    }

    /// Event

    function handleClickListenerAdded(event) {
        const target = event.composedPath()[0];

        if (target.nodeType !== Node.ELEMENT_NODE) {
            return;
        }

        if (!designate(target)) {
            return;
        }

        if (Roots.size === 0) {
            return;
        }

        const root = target.getRootNode();

        if (!Roots.has(root)) {
            return;
        }

        enqueueElement(PendingReview, root, target);
        requestFlush();
    }

    function handleIntersection(entries) {
        for (const { target: box, isIntersecting } of entries) {
            const element = BoxToElement.get(box) ?? box;

            if (isIntersecting) {
                InteractablesInViewport.add(element);
            } else {
                InteractablesInViewport.delete(element);
            }

            survey(box);
        }
    }

    function handleMutation(entries) {
        for (const { addedNodes, removedNodes, target, type } of entries) {
            const root = target.getRootNode();

            if (!Roots.has(root)) {
                continue;
            }

            if (type === "attributes") {
                enqueueElement(PendingReview, root, target);
                continue;
            }

            if (removedNodes.length > 0) {
                enqueueRoot(PendingPrune, root);
            }

            for (const node of addedNodes) {
                if (!node.isConnected) {
                    continue;
                }

                if (node.nodeType !== Node.ELEMENT_NODE) {
                    continue;
                }

                enqueueElement(PendingScan, root, node);
            }
        }

        requestFlush();
    }

    function handleShadowAttached(event) {
        const {
            shadowRoot
        } = event.composedPath()[0];

        if (isIgnorable(shadowRoot)) {
            return;
        }

        whenIdle(() => {
            attach(shadowRoot);
        });
    }

    /// Init

    Events.listen({
        type: "clicklisteneradded",
        handler: handleClickListenerAdded
    }, {
        managed: false
    });

    Script.ready.then(async () => {
        await Promise.all([
            Document.dom,
            Document.queriesReady
        ]);

        whenIdle(() => {
            start();

            Events.listen({
                type: "shadowattached",
                handler: handleShadowAttached
            });
        });
    });

    Script.onResume(start);
    Script.onSuspend(retire);

    return {
        get busy() {
            return busy();
        },
        get interactables() {
            return (function*() {
                for (const root of Roots) {
                    const {
                        interactables
                    } = RootMetadata.get(root);

                    for (const element of interactables) {
                        yield element;
                    }
                }
            })();
        },
        get interactablesInViewport() {
            return InteractablesInViewport.values();
        },
        get roots() {
            return Roots.values();
        },
        settle
    };
})();
