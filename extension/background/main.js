"use strict";

const ACTION = (() => {
    const name = browser.runtime.getManifest().name;

    return Object.freeze({
        icon: {
            [true]: "asset/icon/relm.ico",
            [false]: null
        },
        title: {
            [true]: `${name} オン`,
            [false]: `${name} オフ`
        }
    });
})();

/// Auxiliary

const posmod = (x, n) => x - (n * Math.floor(x / n));

/// API

async function currentTab() {
    const [tab] = await browser.tabs.query({
        active: true,
        currentWindow: true
    });

    return tab;
}

function tabsMatching(pattern) {
    return browser.tabs.query({
        url: pattern
    });
}

async function windowTabs() {
    const tabs = await browser.tabs.query({
        currentWindow: true,
        hidden: false
    });

    return {
        get current() {
            return tabs.find((tab) => tab.active);
        },
        get loaded() {
            return tabs.filter((tab) => !tab.discarded);
        },
        get normal() {
            return tabs.filter((tab) => !tab.pinned);
        },
        get pinned() {
            return tabs.filter((tab) => tab.pinned);
        },
        tabs
    };
};

/// Extension

const sessionKey = ({
    id
}) => `session:${id}`;

function handshake(tab) {
    void browser.storage.session.set({
        [sessionKey(tab)]: true
    });

    return sync(tab);
}

async function inspectBlacklist(url) {
    let {
        blacklist = []
    } = await browser.storage.local.get(["blacklist"]);

    if (!Array.isArray(blacklist)) {
        blacklist = [];
    }

    const pattern = toMatchPattern(url);
    const patternIndex = blacklist.indexOf(pattern);

    return {
        get found() {
            return patternIndex >= 0;
        },
        blacklist,
        pattern,
        patternIndex
    };
}

async function isConnected(tab) {
    const key = sessionKey(tab);

    const {
        [key]: connected
    } = await browser.storage.session.get(key);

    return connected;
}

function setActionAppearance(tab, enabled) {
    return Promise.all([
        setActionIcon(tab, ACTION.icon[enabled]),
        setActionTitle(tab, ACTION.title[enabled])
    ]);
}

function setActionIcon({
    id
}, icon) {
    return browser.action.setIcon({
        tabId: id,
        path: icon
    });
}

function setActionTitle({
    id
}, title) {
    return browser.action.setTitle({
        tabId: id,
        title
    });
}

function setEnabled(tab, enabled) {
    const tasks = [];

    const {
        discarded,
        id
    } = tab;

    if (!discarded) {
        tasks.push(browser.tabs.sendMessage(id, {
            action: "enable",
            args: enabled
        }).catch(() => { /* pinned+unrestored (no test) */ }));
    }

    tasks.push(setActionAppearance(tab, enabled));

    return Promise.all(tasks);
}

async function sync(tab) {
    const {
        found: blacklisted
    } = await inspectBlacklist(new URL(tab.url));

    return setEnabled(tab, !blacklisted);
}

function toMatchPattern({
    hostname,
    pathname,
    protocol
}) {
    switch (protocol) {
        case "http:":
        case "https:":
            return `*://${hostname}/*`;
        case "file:":
            return `file://${pathname}*`;
        case "about:":
            return `about:${pathname}*`;
    }

    throw new Error(`Unsupported protocol '${protocol}'`);
}

async function toggleInBlacklist(url) {
    const {
        blacklist,
        found: enable,
        pattern,
        patternIndex: i
    } = await inspectBlacklist(url);

    if (enable) {
        blacklist.splice(i, 1);
    } else {
        blacklist.push(pattern);
    }

    void browser.storage.local.set({
        blacklist
    });

    const tabs = await browser.tabs.query({
        url: pattern
    });

    return Promise.all(tabs.map((tab) => setEnabled(tab, enable)));
}

/// Fn

function back({
    id
}) {
    return browser.tabs.goBack(id);
}

function forward({
    id
}) {
    return browser.tabs.goForward(id);
}

async function open({
    active = false,
    href
}) {
    const {
        id
    } = await currentTab();

    return browser.tabs.create({
        active,
        openerTabId: id,
        url: href
    }).catch(() => {
        console.debug(`Failed opening: ${href}`);
    });
}

async function tabClose() {
    const {
        id
    } = await currentTab();

    return browser.tabs.remove(id);
}

async function tabCycle(n) {
    const {
        current,
        tabs
    } = await windowTabs();

    const i = tabs.indexOf(current);
    const target = tabs[posmod(i + n, tabs.length)];

    return browser.tabs.update(target.id, {
        active: true
    });
}

function tabFirst() {
    return tabSkip(-1);
}

async function tabJump(sign) {
    const {
        current,
        normal,
        pinned
    } = await windowTabs();

    const index = current.pinned
        ? pinned.at(sign > 0 ? -1 : 0).index
        : normal.at(sign > 0 ? -1 : 0).index;

    return browser.tabs.move(current.id, {
        index
    });
};

function tabLast() {
    return tabSkip(1);
}

function tabLeft() {
    return tabMove(-1);
}

function tabLeftmost() {
    return tabJump(-1);
}

function tabNext() {
    return tabCycle(1);
}

function tabNew() {
    return browser.tabs.create({
        active: true
    });
}

async function tabMove(n) {
    const {
        current,
        normal,
        pinned
    } = await windowTabs();

    const among = current.pinned ? pinned : normal;
    const index = among[
        posmod(among.indexOf(current) + n, among.length)
    ].index;

    return browser.tabs.move(current.id, {
        index
    });
}

async function tabPin() {
    const {
        id,
        pinned
    } = await currentTab();

    return browser.tabs.update(id, {
        pinned: !pinned
    });
}

function tabPrev() {
    return tabCycle(-1);
}

async function tabReload({
    bypassCache = false
} = {}) {
    const {
        id
    } = await currentTab();

    return browser.tabs.reload(id, {
        bypassCache
    });
}

function tabRestore() {
    browser.sessions.restore();
}

function tabRight() {
    return tabMove(1);
}

function tabRightmost() {
    return tabJump(1);
}

async function tabSkip(sign) {
    const {
        current,
        normal,
        pinned,
        tabs
    } = await windowTabs();

    const neighbor = tabs[current.index + Math.sign(sign)];

    if (neighbor === undefined) {
        return current;
    }

    const id = neighbor.pinned
        ? pinned.at(sign > 0 ? -1 : 0).id
        : normal.at(sign > 0 ? -1 : 0).id;

    return browser.tabs.update(id, {
        active: true
    });
}

async function tabUnload() {
    const {
        current,
        loaded,
        tabs
    } = await windowTabs();

    if (loaded.length === 1) {
        await tabNew();
    } else {
        const i0 = loaded.indexOf(current);
        const i1 = i0 === loaded.length - 1
            ? i0 - 1
            : i0 + 1;

        await browser.tabs.update(loaded[i1].id, {
            active: true
        });
    }

    return browser.tabs.discard(current.id);
}

/// Event

browser.action.onClicked.addListener(async (tab) => {
    if (!await isConnected(tab)) {
        return;
    }

    toggleInBlacklist(new URL(tab.url));
});

browser.commands.onCommand.addListener(async (command, tab) => {
    if (!await isConnected(tab)) {
        return;
    }

    switch (command) {
        case "toggle-site":
            const url = new URL(tab.url);
            toggleInBlacklist(url);
            break;
        default:
            browser.tabs.sendMessage(tab.id, {
                action: command
            });
            break;
    }
});

browser.runtime.onMessage.addListener(({
    action,
    args
}, {
    tab
}) => {
    switch (action) {
        case "back":
            back(tab);
            break;
        case "forward":
            forward(tab);
            break;
        case "handshake":
            handshake(tab);
            break;
        case "log":
            console.log(...args);
            break;
        case "open":
            open(args);
            break;
        case "sync":
            sync(tab);
            break;
        case "tab-close":
            tabClose();
            break;
        case "tab-first":
            tabFirst();
            break;
        case "tab-last":
            tabLast();
            break;
        case "tab-left":
            tabLeft();
            break;
        case "tab-leftmost":
            tabLeftmost();
            break;
        case "tab-next":
            tabNext();
            break;
        case "tab-new":
            tabNew();
            break;
        case "tab-pin":
            tabPin();
            break;
        case "tab-prev":
            tabPrev();
            break;
        case "tab-reload":
            tabReload(args);
            break;
        case "tab-restore":
            tabRestore();
            break;
        case "tab-right":
            tabRight();
            break;
        case "tab-rightmost":
            tabRightmost();
            break;
        case "tab-unload":
            tabUnload();
            break;
    }

    return false;
});
