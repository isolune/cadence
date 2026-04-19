"use strict";

class Bug extends Error {
    constructor(message) {
        super(message);

        this.name = this.constructor.name;
    }
}

class UnexpectedError extends Bug {}

class StartupError extends Error {
    constructor(message) {
        super(message);

        this.name = this.constructor.name;
    }
}
