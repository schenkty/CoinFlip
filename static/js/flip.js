/* @flow */
let currentGameID;
let ws;
let currentGame = {};
let headsCount = 0;
let tailsCount = 0;

function setHolder(result) {
    // set holder to winner
    let holder = document.getElementById('coin-holder');
    let coin = document.getElementById('coin');
    holder.src = `/${ result }.png`;
    holder.style.display = 'block';
    coin.style.display = 'none';
}

function processResult(result) {
    let status = document.getElementById('final_winner');
    let heads = document.querySelector('.headsCount');
    let tails = document.querySelector('.tailsCount');

    if (result === 'heads') {
        headsCount += 1;
        heads.innerText = headsCount;
        status.innerHTML = `You Won!`;
    } else {
        tailsCount += 1;
        tails.innerText = tailsCount;
        status.innerHTML = `You Lost!`;
    }

    setTimeout(() => {
        setHolder(result);
    }, 500);
}

function flip(token) {
    let coin = document.getElementById('coin');

    coin.style.transform = 'rotateX(1800deg) scale(2)';

    ws = new WebSocket(`ws://127.0.0.1:${ SOCKET }`);

    currentGame.bbToken = token;

    ws.onopen = function() {
        // Web Socket is connected, send data using send()
        ws.send(JSON.stringify({
            'event':   'subscribe',
            'bbToken': token
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
                coin.src = '/heads.png';
                processResult('heads');
            } else if (data.won === false && currentGame.won == false) {
                // player lost
                console.log('You Lost!');
                coin.src = '/tails.png';
                processResult('tails');
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
