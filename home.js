// static/home.js

document.addEventListener("DOMContentLoaded", function() {
    const gameTypeField = document.getElementById('gameType');
    const roomTypeField = document.getElementById('roomType');
    const roomNameField = document.getElementById('roomName');
    gameTypeField.addEventListener('change', function() {
        const gameType = gameTypeField.value;
        if (gameType === 'multiplayer') {
            roomTypeField.style.display = 'block';
            roomTypeField.required = true;
            toggleRoomName();
        } else {
            roomTypeField.style.display = 'none';
            roomTypeField.required = false;
            roomNameField.style.display = 'none';
            roomNameField.required = false;
        }
    });

    roomTypeField.addEventListener('change', toggleRoomName);

    function toggleRoomName() {
        const roomType = roomTypeField.value;
        if (roomType === 'join') {
            roomNameField.style.display = 'block';
            roomNameField.required = true;
        } else {
            roomNameField.style.display = 'none';
            roomNameField.required = false;
        }
    }
});
