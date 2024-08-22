// static/game.js

document.addEventListener("DOMContentLoaded", function() {
    const socket = io();
    const room = document.body.getAttribute('data-room');
    const playerName = document.body.getAttribute('data-player');

    const playerList = document.getElementById('players');
    const handList = document.getElementById('hand');
    const board = document.getElementById('board');

    // Join the room
    socket.emit('join', { room: room, player: playerName });

    // Update player list when a new player joins
    socket.on('player_joined', function(data) {
        const li = document.createElement('li');
        li.textContent = data.player;
        playerList.appendChild(li);
    });

    // Handle game start
    socket.on('start_game', function() {
        // Logic to start the game (deal cards, etc.)
        alert('The game has started!');
    });

    // Handle card play
    socket.on('card_played', function(data) {
        board.textContent = `${data.player} played ${data.card}`;
        // Logic to update the board with the played card
    });

    // Handle passing turn
    socket.on('turn_passed', function(data) {
        alert(`${data.player} has passed their turn.`);
    });

    // Event listeners for buttons
    document.getElementById('passButton').addEventListener('click', function() {
        socket.emit('pass_turn', { room: room, player: playerName });
    });

    document.getElementById('settingsButton').addEventListener('click', function() {
        // Logic to open settings
        alert('Settings button clicked');
    });
});
