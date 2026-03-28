"use strict";

const Tracker = (function() {
    const INTERSECTION_THRESHOLD = 0.05;

    const MUTATION_DEBOUNCE_MS = 50;
    const MUTATION_MAX_SIFT = 50;

    const InteractablesInViewport = new Set();

    const Roots = new Set();
    const RootsQueue = [];
    const RootMetadata = new WeakMap();

    const ElementToBox = new WeakMap();
    const BoxToElement = new WeakMap();

    const Intersections = new IntersectionObserver(handleIntersection, {
        // delay: 100,
        threshold: INTERSECTION_THRESHOLD,
        // trackVisibility: true // TODO: Wait for FF
        // https://caniuse.com/mdn-api_intersectionobserver_trackvisibility
    });

    const PendingPrune = new Set();
    const PendingReview = new Map();
    const PendingScan = new Map();

    let MutationTimer = null;

    /// Private

    function attach(root) {
        if (!root.isConnected || Roots.has(root)) {
            return;
        }

        const mutations = new MutationObserver(handleMutation);

        mutations.observe(root, {
            attributes: true,
            attributeFilter: Document.attributes.interactive,
            childList: true,
            subtree: true
        });

        Roots.add(root);
        RootMetadata.set(root, {
            interactables: new Set(),
            mutations
        });

        scan(root);
    }

    function detach(root) {
        const {
            interactables,
            mutations
        } = RootMetadata.get(root);

        for (const element of interactables) {
            untrack(element);
        }

        mutations.disconnect();

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

    function flushMutations() {
        pruneRemoved();
        scanAdded();
        reviewChanged();
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

    function retire() {
        for (const root of Roots) {
            detach(root);
        }

        window.clearTimeout(MutationTimer);

        MutationTimer = null;
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

                if (element.matches(Document.queries.interactive)) {
                    track(element, interactables);
                } else {
                    untrack(element, interactables);
                }
            }
        }

        PendingReview.clear();
    }

    function scan(node, root = node) {
        const {
            interactables
        } = RootMetadata.get(root);

        const results = node.querySelectorAll(Document.queries.interactive);

        if (node.nodeType === Node.ELEMENT_NODE) {
            if (node.matches(Document.queries.interactive)) {
                track(node, interactables);
            }
        }

        for (const element of results) {
            track(element, interactables);
        }
    }

    function scanAdded() {
        for (const [root, added] of PendingScan.entries()) {
            if (added.length > MUTATION_MAX_SIFT) {
                scan(root);
                PendingReview.delete(root);
            } else {
                const ancestors = Document.ancestorsOnly(
                    added.filter((a) => a.isConnected)
                );

                for (const ancestor of ancestors) {
                    scan(ancestor, root);
                }
            }
        }

        PendingScan.clear();
    }

    function start({
        blind
    }) {
        if (blind) {
            walk();
        } else {
            attach(document);
        }

        while (RootsQueue.length > 0) {
            attach(RootsQueue.shift());
        }
    }

    function track(element, members) {
        if (members.has(element)) {
            return;
        }

        members.add(element);

        const box = Document.firstLayoutElement(element) ?? element;

        if (element !== box) {
            ElementToBox.set(element, box);
            BoxToElement.set(box, element);
        }

        Intersections.observe(box);
    }

    function untrack(element, members = null) {
        if (members !== null) {
            if (!members.delete(element)) {
                return;
            }
        }

        const box = ElementToBox.get(element) ?? element;

        if (element !== box) {
            ElementToBox.delete(element);
            BoxToElement.delete(box);
        }

        InteractablesInViewport.delete(element);
        Intersections.unobserve(box);
    }

    function walk(root = document) {
        RootsQueue.push(root);

        for (const element of root.querySelectorAll("*")) {
            const shadowRoot = element.shadowRoot;

            if (shadowRoot === null) {
                continue;
            }

            walk(shadowRoot);
        }
    }

    /// Event

    function handleIntersection(entries) {
        for (const { target: box, isIntersecting } of entries) {
            const element = BoxToElement.get(box) ?? box;

            if (isIntersecting) {
                InteractablesInViewport.add(element);
            } else {
                InteractablesInViewport.delete(element);
            }
        }
    }

    function handleMutation(entries) {
        for (const { addedNodes, removedNodes, target, type } of entries) {
            const root = target.getRootNode();

            if (!Roots.has(root)) {
                continue;
            }

            if (type === "attributes") {
                PendingReview.getOrInsertComputed(
                    root,
                    () => []
                ).push(target);

                continue;
            }

            if (removedNodes.length > 0) {
                PendingPrune.add(root);
            }

            for (const node of addedNodes) {
                if (!node.isConnected) {
                    continue;
                }

                if (node.nodeType !== Node.ELEMENT_NODE) {
                    continue;
                }

                PendingScan.getOrInsertComputed(
                    root,
                    () => []
                ).push(node);
            }
        }

        window.clearTimeout(MutationTimer);

        MutationTimer = window.setTimeout(flushMutations, MUTATION_DEBOUNCE_MS);
    }

    function handleShadowAttached(event) {
        const root = event.composedPath()[0].shadowRoot;

        switch (Script.state) {
            case "active":
                attach(root);
                break;
            case "init":
                RootsQueue.push(root);
                break;
        }
    }

    /// Init

    Events.listen({
        type: "shadowattached",
        handler: handleShadowAttached
    });

    Script.ready.then(async () => {
        await Document.queriesReady;

        start({
            blind: !Script.primeRun
        });
    });

    Script.onResume(() => {
        start({
            blind: true
        });
    });

    Script.onSuspend(retire);

    return {
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
        }
    };
})();
