// static/game.js

document.addEventListener("DOMContentLoaded", function() {
    const socket = io();

    const room = document.body.getAttribute('data-room');
    const playerName = document.body.getAttribute('data-player');
    const numPlayers = document.body.getAttribute('data-num-players');

    // Activate player circles based on number of players
    const playerCircles = document.querySelectorAll('.playerCircle');
    activatePlayers(numPlayers);

    function activatePlayers(numPlayers) {
        const activationMap = {
            4: [2, 4, 6],
            5: [2, 3, 5, 6],
            6: [2, 3, 4, 5, 6],
            7: [1, 2, 3, 5, 6, 7],
            8: [1, 2, 3, 4, 5, 6, 7]
        };
        const activePlayers = activationMap[numPlayers];
        playerCircles.forEach((circle, index) => {
            if (activePlayers.includes(index + 1)) {
                circle.classList.add('active');
            }
        });
    }

    // Handle pass turn
    document.getElementById('passButton').addEventListener('click', function() {
        socket.emit('pass_turn', { room: room, player: playerName });
    });

    // Listen for card played updates
    socket.on('card_played', function(data) {
        updateBoard(data);
    });

    // Listen for turn passed updates
    socket.on('turn_passed', function(data) {
        console.log(`${data.player} passed. Next player: ${data.next_player}`);
    });

    // Update board UI (cards played)
    function updateBoard(data) {
        const board = document.getElementById('board');
        board.textContent = `${data.player} played ${data.card}`;
        // Additional logic to render the played cards visually
    }

    // Additional UI updates based on game events...
});
