// static/home.js

const socket = io();
let currentRoom = null;

socket.on('connect', function() {
    console.log('Connected to the server');
});

socket.on('room_created', function(data) {
    currentRoom = data.room;
    document.getElementById('players').innerHTML = `<li>${data.player}</li>`;
    document.getElementById('messages').innerHTML += `<li>Room ${data.room} created by ${data.player}</li>`;
});

socket.on('player_joined', function(data) {
    document.getElementById('players').innerHTML += `<li>${data.player}</li>`;
    document.getElementById('messages').innerHTML += `<li>Player ${data.player} joined</li>`;
});

socket.on('add_computers', function(data) {
    data.computers.forEach(computer => {
        document.getElementById('players').innerHTML += `<li>${computer}</li>`;
    });
});

socket.on('start_game', function() {
    document.getElementById('messages').innerHTML += `<li>Game started!</li>`;
});

socket.on('cards_dealt', function(data) {
    const hand = data.hands[socket.id];
    document.getElementById('hand').innerHTML = '';
    hand.forEach(card => {
        document.getElementById('hand').innerHTML += `<li>${card}</li>`;
    });
});

socket.on('card_played', function(data) {
    document.getElementById('messages').innerHTML += `<li>${data.player} played ${data.card}</li>`;
});

function dealCards() {
    socket.emit('deal_cards', currentRoom);
}

function playAgain() {
    location.reload();
}

function goHome() {
    window.location.href = "/";
}
