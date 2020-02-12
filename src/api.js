/* @flow */
/* global express$Request */
/* global express$Response */

import { join } from 'path';

import WebSocket from 'ws';
import express from 'express';
import uuid from 'uuid';

import { oddOrEven, toHash, generateRandom } from './helper';
import { SERVER_WS } from './config';

const wss = new WebSocket.Server({ port: SERVER_WS });

const ROOT_DIR = join(__dirname, '..');
const pulseTime = 10;
export let app = express();

app.use(express.urlencoded());
app.use(express.json());
app.get('/', (req : express$Request, res : express$Response) => res.sendFile(join(ROOT_DIR, 'static/index.html')));
app.get('/bundle.js', (req : express$Request, res : express$Response) => res.sendFile(join(ROOT_DIR, 'static/js/bundle.js')));
// app.get('/sha256.js', (req : express$Request, res : express$Response) => res.sendFile(join(ROOT_DIR, 'static/js/sha256.js')));

// websocket subscriber map
let subscriptionMap = {};
let gameMap = {};

function subscribeGames(ws) {

    let gameID = uuid.v4();
    let loop = true;

    while (loop) {
        if (ws.subscriptions.indexOf(gameID) !== -1) { // Already subscribed
            gameID = uuid.v4();
        } else {
            loop = false;
            break;
        }
    }

    ws.subscriptions.push(gameID);

    console.log('subscribed', gameID);
    // notify the user they are subscribed
    const event = {
        event: 'subscribed',
        game:  gameID
    };
    ws.send(JSON.stringify(event));

    // Add into global map
    if (!subscriptionMap[gameID]) {
        subscriptionMap[gameID] = [];
    }

    subscriptionMap[gameID].push(ws);
}

function unsubscribeGames(ws, game) {
    const existingSub = ws.subscriptions.indexOf(game);
    if (existingSub === -1) {
        return; // Not subscribed
    }

    ws.subscriptions.splice(existingSub, 1);

    // Remove from global map
    if (!subscriptionMap[game]) {
        return; // Nobody subscribed to this account?
    }

    const globalIndex = subscriptionMap[game].indexOf(ws);

    if (globalIndex === -1) {
        console.log(`Subscribe, not found in the global map?  Potential leak? `, game);
        return;
    }

    subscriptionMap[game].splice(globalIndex, 1);
}

function flip(ws, game) {
    const currentGame = gameMap[game];

    let final = `final${  currentGame.houseRandom  }${ currentGame.playerRandom }`;
    let finalHash = toHash(final);
    let num = parseInt(finalHash.charAt(37), 16);

    let clientEvent = {
        event:     'gameUpdate'
    };

    if (oddOrEven(num)) {
        // house won
        clientEvent.won = false;
        console.log('House Won!');
    } else {
        // house lost
        clientEvent.won = true;
        console.log('House Lost');
    }
    // send update event to client
    ws.send(JSON.stringify(clientEvent));
}

function newGame(ws, game) {
    if (ws.subscriptions.indexOf(game) === -1) {
        return; // Not subscribed
    }

    let gameObj = {};
    gameObj.houseRandom = generateRandom();
    gameObj.houseHash = toHash(gameObj.houseRandom);

    gameMap[game] = gameObj;

    const event = {
        event:     'houseHash',
        hash:  gameObj.houseHash
    };
    ws.send(JSON.stringify(event));
}

function getPlayerRandom(ws, game, playerRandom) {
    if (ws.subscriptions.indexOf(game) === -1) {
        return; // Not subscribed
    }

    gameMap[game].playerRandom = playerRandom;

    const event = {
        event:       'houseRandom',
        houseRandom:  gameMap[game].houseRandom
    };
    ws.send(JSON.stringify(event));
}

function parseEvent(ws, event) {
    let game = '';
    let playerRandom = '';
    if (event.hasOwnProperty('game') && typeof event.game === 'string') {
        game = event.game;
    }
    if (event.hasOwnProperty('playerRandom')) {
        playerRandom = event.playerRandom;
    }
    switch (event.event) {
    case 'subscribe':
        subscribeGames(ws);
        break;
    case 'unsubscribe':
        unsubscribeGames(ws, game);
        break;
    case 'newGame':
        newGame(ws, game);
        break;
    case 'playerRandom':
        getPlayerRandom(ws, game, playerRandom);
        // flip game
        flip(ws, game);
        break;
    default:
        break;
    }
}

wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.subscriptions = [];

    ws.on('message', message => {
        try {
            const event = JSON.parse(message);
            parseEvent(ws, event);
        } catch (err) {
            console.log(`Bad message: `, err);
        }
    });

    ws.on('close', event => {
        console.log(`Flip Socket - Connection Closed`, event);

        for (let game of ws.subscriptions) {
            if (!subscriptionMap[game] || !subscriptionMap[game].length) {
                return;
            } // Not in there for some reason?

            subscriptionMap[game] = subscriptionMap[game].filter(subWs => subWs !== ws);

            if (subscriptionMap[game].length === 0) {
                delete subscriptionMap[game];
            }
        }
    });
});

function ping(ws) {
    // send ping to destination
    const time = Date.now();
    const event = {
        event: 'ping',
        data:  time
    };
    ws.send(JSON.stringify(event));
}

function pulse() : Promise<void> {
    for (let destination of Object.keys(subscriptionMap)) {
        for (let ws of subscriptionMap[destination]) {
            // kill dead connections
            if (ws.isAlive === false) {
                ws.terminate();
                continue;
            }

            // send ping to destination
            ping(ws);
        }
    }
}

setInterval(pulse, pulseTime * 1000); // Print stats every x seconds
