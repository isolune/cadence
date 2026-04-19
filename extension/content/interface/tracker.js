"use strict";

const Tracker = (function() {
    const Scheduler = (function() {
        const Declared = new Map();
        const Deferred = new Map();
        const Expected = new Set();

        const pop = (map, key, onValue) => {
            const value = map.get(key);

            if (!map.delete(key)) {
                return false;
            }

            onValue(value);
            return true;
        };

        /// Public

        function cancel(fn) {
            return pop(Deferred, fn, (id) => {
                window.cancelIdleCallback(id);
            });
        }

        function drain() {
            for (const fn of Deferred.keys()) {
                finish(fn);
            }
        }

        function due(fn) {
            return Deferred.has(fn);
        }

        function finish(fn) {
            if (!cancel(fn)) {
                return false;
            }

            run(fn);

            return true;
        }

        function halt() {
            for (const fn of Declared.keys()) {
                revoke(fn);
            }

            for (const fn of Deferred.keys()) {
                cancel(fn);
            }

            Expected.clear();
        }

        function held(fn) {
            return Declared.has(fn);
        }

        function hold(fn) {
            Declared.getOrInsertComputed(
                fn,
                () => Promise.withResolvers()
            );
        }

        function schedule(fn) {
            if (due(fn)) {
                return;
            }

            if (Expected.delete(fn)) {
                run(fn);
            } else {
                defer(fn);
            }
        }

        function upon(fn) {
            hold(fn);

            const {
                promise
            } = Declared.get(fn);

            return promise;
        }

        function urge(fn) {
            if (finish(fn)) {
                return Promise.resolve();
            }

            Expected.add(fn);

            return upon(fn);
        }

        /// Private

        function defer(fn) {
            if (due(fn)) {
                return;
            }

            const id = window.requestIdleCallback((deadline) => {
                Deferred.delete(fn);

                if (!Script.active) {
                    revoke(fn);
                    return;
                }

                run(fn, deadline);
            });

            Deferred.set(fn, id);
        }

        function close(fn) {
            pop(Declared, fn, ({
                resolve
            }) => {
                resolve();
            });
        }

        function revoke(fn) {
            pop(Declared, fn, ({
                reject
            }) => {
                reject()
            });
        }

        function run(fn, deadline) {
            const timer = (
                deadline !== undefined
                    ? deadline.timeRemaining.bind(deadline)
                    : () => Infinity
            );

            if (fn(timer) !== false) {
                close(fn);
            } else {
                defer(fn);
            }
        }

        return Object.freeze({
            get any() {
                return Deferred.size > 0;
            },
            cancel,
            drain,
            due,
            halt,
            held,
            hold,
            finish,
            schedule,
            upon,
            urge
        });
    })();

    const Surveyor = (function() {
        const INTERSECTION_THRESHOLD = 0.05;

        const Intersections = new IntersectionObserver(handleIntersections, {
            threshold: INTERSECTION_THRESHOLD,
        });

        const IntersectionsPending = new Set();
        const Intersecting = new Set();

        const ItemToTarget = new WeakMap();
        const TargetToItem = new WeakMap();

        let Report = null;

        /// Public

        function bail() {
            Report?.reject();
        }

        function drop(item) {
            const target = targetFrom(item);

            if (item !== target) {
                disassociate(item, target);
            }

            confirm(target);

            Intersections.unobserve(target);
            Intersecting.delete(item);
        }

        function hand(item) {
            const target = targetFor(item);

            if (item !== target) {
                associate(item, target);
            }

            IntersectionsPending.add(target);
            Intersections.observe(target);
        }

        function open() {
            return IntersectionsPending.size > 0;
        }

        /// Private

        function associate(item, target) {
            ItemToTarget.set(item, target);
            TargetToItem.set(target, item);
        }

        function confirm(target) {
            if (IntersectionsPending.delete(target) && IntersectionsPending.size === 0) {
                Report?.resolve();
            }
        }

        function disassociate(item, target) {
            ItemToTarget.delete(item);
            TargetToItem.delete(target);
        }

        function itemFrom(target) {
            return TargetToItem.get(target) ?? target;
        }

        function targetFor(item) {
            return Document.firstSizedElement(item) ?? item;
        }

        function targetFrom(item) {
            return ItemToTarget.get(item) ?? item;
        }

        /// Event

        function handleIntersections(entries) {
            for (const { target, isIntersecting } of entries) {
                const item = itemFrom(target);

                if (isIntersecting) {
                    Intersecting.add(item);
                } else {
                    Intersecting.delete(item);
                }

                confirm(target);
            }
        }

        return Object.freeze({
            get intersecting() {
                return Intersecting.values();
            },
            get open() {
                return open();
            },
            get report() {
                if (!open()) {
                    return Promise.resolve();
                }

                if (Report === null) {
                    Report = Promise.withResolvers();
                    Report.promise.finally(() => Report = null);
                }

                return Report.promise;
            },
            bail,
            drop,
            hand
        });
    })();

    const Workers = (function() {
        const EMA_ALPHA = 0.4;

        const MAX_DELAYS = 8;
        const MAX_REQUEST_MS = 25;

        const List = [];

        const enqueueInMap = (map, key, value) =>
            map.getOrInsertComputed(key, () => []).push(value);

        const enqueueInSet = (set, value) =>
            set.add(value);

        /// Public

        function requestFlush() {
            Scheduler.schedule(flush);
        }

        /// Private

        function create(pending, enqueue, {
            advance,
            timeHint
        }) {
            let impatience = 0;
            let timeExpected = timeHint;

            const worker = Object.freeze({
                get free() {
                    return pending.size === 0;
                },
                get pending() {
                    return pending;
                },
                get work() {
                    return advance(pending);
                },
                bid(budget) {
                    if (budget === Infinity) {
                        return Number.EPSILON;
                    }

                    const wanted = timeExpected * (
                        Math.sqrt(1 - ((impatience / MAX_DELAYS) ** 2))
                    ) * 1.2;

                    if (wanted < budget) {
                        impatience /= 2;
                        return wanted + Number.EPSILON;
                    }

                    if (impatience < MAX_DELAYS) {
                        impatience++;
                    }

                    return 0;
                },
                clock(dt, iters) {
                    if (iters === 0) {
                        return;
                    }

                    timeExpected = Math.min(
                        MAX_REQUEST_MS,
                        (EMA_ALPHA * (Math.max(dt, 1) / iters)) +
                        ((1 - EMA_ALPHA) * timeExpected)
                    );
                }
            });

            List.push(worker);

            return enqueue.bind(null, pending);
        };

        function flush(timer) {
            let allDone = true;

            work: for (const { free, ...worker } of List) {
                if (free) {
                    continue;
                }

                const {
                    bid,
                    clock,
                    work
                } = worker;

                for (
                    let dt,
                        iters = 0,
                        tMin;
                    tMin = bid(timer());
                ) {
                    const t0 = performance.now();

                    do {
                        const {
                            done
                        } = work.next();

                        iters++;

                        if (done) {
                            clock(dt, iters - 1);
                            continue work;
                        }

                        dt = performance.now() - t0;
                    } while (dt < 1 && timer() > tMin);

                    clock(dt, iters);
                }

                allDone = false;
            }

            return allDone;
        }

        return Object.freeze({
            get queues() {
                return List.map(({ pending }) => pending);
            },
            createMapBacked: (...args) => create(new Map(), enqueueInMap, ...args),
            createSetBacked: (...args) => create(new Set(), enqueueInSet, ...args),
            requestFlush
        });
    })();

    const SCAN_MAX_SIFT = 100;

    const SHADOW_HOST_BLACKLIST = Object.freeze([
        "ICONIFY-ICON"
    ]);

    const DesignatedInteractables = new WeakSet();

    const Roots = new Set();
    const RootMetadata = new WeakMap();

    const enqueuePrune = Workers.createSetBacked({
        advance: pruneRemoved,
        timeHint: 2.0
    });

    const enqueueAdopt = Workers.createSetBacked({
        advance: adoptFound,
        timeHint: 4.0
    });

    const enqueueScan = Workers.createMapBacked({
        advance: scanAdded,
        timeHint: 2.0
    });

    const enqueueReview = Workers.createMapBacked({
        advance: reviewChanged,
        timeHint: 1.0
    });

    const enqueueTrack = Workers.createMapBacked({
        advance: trackMatched,
        timeHint: 1.0
    });

    /// Public

    function busy() {
        return Scheduler.any || Surveyor.open
    }

    async function settle() {
        if (Scheduler.held(start)) {
            try {
                await Scheduler.urge(start);
            } catch {
                return;
            }
        }

        if (Scheduler.any) {
            Scheduler.drain();
        }

        return Surveyor.report;
    }

    /// Private

    function acquire(root) {
        if (!root.isConnected) {
            return;
        }

        if (Roots.has(root)) {
            throw new UnexpectedError("Acquired root twice");
        }

        Roots.add(root);

        RootMetadata.set(root, {
            interactables: new Set(),
            observer: new MutationObserver(handleMutations)
        });

        enqueueAdopt(root);
    }

    function* adoptFound(pending) {
        for (const root of pending) {
            pending.delete(root);

            observe(root);
            scan(root);

            yield;
        }
    }

    function designate(element) {
        if (DesignatedInteractables.has(element)) {
            return false;
        }

        DesignatedInteractables.add(element);

        return true;
    }

    function isIgnorable(shadowRoot) {
        const {
            host: {
                tagName
            }
        } = shadowRoot;

        return SHADOW_HOST_BLACKLIST.includes(tagName);
    }

    function observe(root) {
        const {
            observer
        } = RootMetadata.get(root);

        observer.observe(root, {
            attributes: true,
            attributeFilter: Document.attributes.interactive,
            childList: true,
            subtree: true
        });
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

    function* pruneRemoved(pending) {
        for (const root of Roots) {
            if (root.isConnected) {
                continue;
            }

            pull(root);
        }

        for (const root of pending) {
            pending.delete(root);
            prune(root);

            yield;
        }
    }

    function pull(root) {
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

        for (const pending of Workers.queues) {
            pending.delete(root);
        }
    }

    function* reviewChanged(pending) {
        for (const [root, changed] of pending.entries()) {
            const {
                interactables
            } = RootMetadata.get(root);

            while (changed.length > 0) {
                const element = changed.pop();

                if (!element.isConnected) {
                    continue;
                }

                const pass = DesignatedInteractables.has(element)
                    ? !element.matches(Document.queries.nonInteractive)
                    :  element.matches(Document.queries.interactive);

                if (pass) {
                    enqueueTrack(root, element);
                } else {
                    untrack(element, interactables);
                }

                yield;
            }

            pending.delete(root);
        }
    }

    function scan(node, root = node) {
        const results = node.querySelectorAll(Document.queries.interactive);

        if (
            node.nodeType === Node.ELEMENT_NODE &&
            node.matches(Document.queries.interactive)
        ) {
            enqueueTrack(root, node);
        }

        for (const element of results) {
            enqueueTrack(root, element);
        }
    }

    function* scanAdded(pending) {
        for (const [root, added] of pending.entries()) {
            const {
                interactables
            } = RootMetadata.get(root);

            if (added.length > SCAN_MAX_SIFT) {
                pending.delete(root);
                scan(root);

                yield;
                continue;
            }

            const minimized = Document.treeTops(
                added.filter((element) => element.isConnected)
            );

            pending.set(root, minimized);

            yield;

            while (minimized.length > 0) {
                const element = minimized.pop();
                scan(element, root);

                yield;
            }

            pending.delete(root);
        }
    }

    function start(timer) {
        if (Roots.size > 0) {
            throw new UnexpectedError("Tracker started in unclean state");
        }

        walkRoots();

        Events.listen(ShadowAttachedEvent);
    }

    function stop() {
        Scheduler.halt();
        Surveyor.bail();

        for (const root of Roots) {
            pull(root);
        }
    }

    function track(element, interactables) {
        if (interactables.has(element)) {
            return;
        }

        interactables.add(element);
        Surveyor.hand(element);
    }

    function* trackMatched(pending) {
        for (const [root, matched] of pending.entries()) {
            const {
                interactables
            } = RootMetadata.get(root);

            while (matched.length > 0) {
                const element = matched.pop();
                track(element, interactables);

                yield;
            }

            pending.delete(root);
        }
    }

    function untrack(element, interactables = null) {
        if (interactables !== null) {
            if (!interactables.delete(element)) {
                return;
            }
        }

        Surveyor.drop(element);
    }

    function walkRoots() {
        (function walk(root = document) {
            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_ELEMENT
            );

            acquire(root);

            for (let node; node = walker.nextNode();) {
                const {
                    shadowRoot
                } = node;

                if (DesignatedInteractables.has(node)) {
                    enqueueReview(root, node);
                }

                if (shadowRoot === null || isIgnorable(shadowRoot)) {
                    continue;
                }

                walk(shadowRoot);
            }
        })();

        Workers.requestFlush();
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

        enqueueReview(root, target);
        Workers.requestFlush();
    }

    function handleMutations(entries) {
        for (const { addedNodes, removedNodes, target, type } of entries) {
            const root = target.getRootNode();

            if (!Roots.has(root)) {
                continue;
            }

            if (type === "attributes") {
                enqueueReview(root, target);
                continue;
            }

            if (removedNodes.length > 0) {
                enqueuePrune(root);
            }

            for (const node of addedNodes) {
                if (!node.isConnected) {
                    continue;
                }

                if (node.nodeType !== Node.ELEMENT_NODE) {
                    continue;
                }

                enqueueScan(root, node);
            }
        }

        Workers.requestFlush();
    }

    function handleShadowAttached(event) {
        const {
            shadowRoot
        } = event.composedPath()[0];

        if (isIgnorable(shadowRoot)) {
            return;
        }

        acquire(shadowRoot);
        Workers.requestFlush();
    }

    /// Init

    Events.define({
        type: "clicklisteneradded",
        handler: handleClickListenerAdded
    }, {
        managed: false,
        mode: EventsFlag.EAGER
    });

    const ShadowAttachedEvent = Events.define({
        type: "shadowattached",
        handler: handleShadowAttached
    }, {
        mode: EventsFlag.LAZY
    });

    Script.onActive(async ({
        primeRun
    }) => {
        if (primeRun) {
            Scheduler.hold(start);
        } else {
            void Scheduler.urge(start);
        }

        await Document.dom;

        Scheduler.schedule(start);
    });

    Script.onSuspended(stop);

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
            return Surveyor.intersecting;
        },
        get roots() {
            return Roots.values();
        },
        settle
    };
})();
