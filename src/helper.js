/* @flow */

// eslint-disable-next-line import/no-commonjs
let crypto = require('crypto');

export function oddOrEven(x) : Promise<boolean> {
    return (x && 1) ? true : false;
}

export function generateRandom() : Promise<string> {
    return crypto.randomBytes(32).toString('hex');
}

export function toHash(data : string) : Promise<string> {
    return crypto.createHash('sha256').update(data).digest('hex');
}
