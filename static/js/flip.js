/* @flow */
let currentGameID;
let ws;
let currentGame = {};
let headsCount = 0;
let tailsCount = 0;
let SOCKET = 3001;

function processResult(result) {
    let status = document.getElementById('final_winner');
    let heads = document.querySelector('.headsCount');
    let tails = document.querySelector('.tailsCount');

    if (result === 'won') {
        headsCount += 1;
        heads.innerText = headsCount;
        status.innerHTML = `You Won!`;
    } else {
        tailsCount += 1;
        tails.innerText = tailsCount;
        status.innerHTML = `You Lost!`;
    }
}

function flip() {
    ws = new WebSocket(`ws://127.0.0.1:${ SOCKET }`);

    ws.onopen = function() {
        // Web Socket is connected, send data using send()
        ws.send(JSON.stringify({
            'event':   'subscribe'
        }));
    };

    ws.onmessage = function(message) {
        const data = JSON.parse(message.data);
        switch (data.event) {
        case 'subscribed':
            // reset local game object
            currentGame = {};
            currentGameID = data.game;

            ws.send(JSON.stringify({
                'event': 'newGame',
                'game':  currentGameID
            }));
            break;
        case 'houseHash':
            if (currentGame.hasOwnProperty('houseHash')) {
                alert('House is flawed!');
            } else {
                // save house hash to local object
                currentGame.houseHash = data.hash;

                // generate player random and hash
                let playerRandom = generateRandom();
                currentGame.playerRandom = playerRandom;

                // send player random hash to server
                ws.send(JSON.stringify({
                    'event': 'playerRandom',
                    'game':  currentGameID,
                    playerRandom
                }));
            }
            break;
        case 'houseRandom':
            // verify that the house random is the same as the house hash
            if (currentGame.houseHash === toHash(data.houseRandom)) {
                console.log('House is Verified!');
                let final = `final${  data.houseRandom  }${ currentGame.playerRandom }`;
                let finalHash = toHash(final);
                let num = parseInt(finalHash.charAt(37), 16);

                if (oddOrEven(num)) {
                    // house lost
                    currentGame.won = true;
                } else {
                    // house won
                    currentGame.won = false;
                }
            } else {
                alert('House is flawed!');
            }
        case 'gameUpdate':
            // notify player if we won or lost.
            if (data.won === true && currentGame.won === true) {
                // player won
                console.log('You Won!!');
                processResult('won');
            } else if (data.won === false && currentGame.won == false) {
                // player lost
                console.log('You Lost!');
                processResult('lost');
            }
        case 'ping':
            break;
        default:
            break;
        }
    };

    ws.onclose = function() {
    // websocket is closed.
        console.log('Flip Socket Connection is closed...');
    };
}
