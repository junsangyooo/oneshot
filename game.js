// static/game.js

document.addEventListener("DOMContentLoaded", function() {
    // Initial setup and socket connections here
    const socket = io();

    const playerList = document.getElementById('players');
    const handList = document.getElementById('hand');
    const board = document.getElementById('board');

    // Example to add players to the player section
    const players = ['Player 1', 'Player 2', 'Player 3', 'Player 4'];
    players.forEach(player => {
        const li = document.createElement('li');
        li.textContent = player;
        playerList.appendChild(li);
    });

    // Example to add cards to the player's hand
    const handCards = ['2', '4', '5', '7', '10', '12'];
    handCards.forEach(card => {
        const li = document.createElement('li');
        li.textContent = card;
        handList.appendChild(li);
    });

    // Event listeners for the buttons
    document.getElementById('drawCardButton').addEventListener('click', function() {
        // Logic for drawing a card
        alert("Draw card button clicked");
    });

    document.getElementById('emojiButton').addEventListener('click', function() {
        // Logic for sending an emoji
        alert("Emoji button clicked");
    });

    document.getElementById('settingsButton').addEventListener('click', function() {
        // Logic for opening settings
        alert("Settings button clicked");
    });

    // Example socket connection for real-time updates
    socket.on('updateBoard', function(data) {
        // Update the board with new data
        board.textContent = `Card played: ${data.card}`;
    });
});
