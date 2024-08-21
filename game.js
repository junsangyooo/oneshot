// static/game.js

const socket = io();
let room = document.getElementById('gameInfo').getAttribute('room');
let player = document.getElementById('gameInfo').getAttribute('player');

socket.emit('create_room', { room: room, player: player, num_players: document.getElementById('gameInfo').getAttribute('num_players') });

socket.on('room_created', function(data) {
    if (data.player === player) {
        socket.emit('start_game', room);
    }
});
