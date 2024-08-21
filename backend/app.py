from flask import Flask, render_template
from flask_socketio import SocketIO, emit, join_room, leave_room
import random

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'
socketio = SocketIO(app)

# Serve the main page
@app.route('/')
def index():
    return render_template('index.html')

# Handle player connection
@socketio.on('connect')
def handle_connect():
    print('A player connected.')

# Handle player disconnection
@socketio.on('disconnect')
def handle_disconnect():
    print('A player disconnected.')

# Handle creating a game room
@socketio.on('create_room')
def handle_create_room(room):
    join_room(room)
    emit('room_created', {'room': room}, room=room)
    print(f'Room {room} created.')

# Handle joining a game room
@socketio.on('join_room')
def handle_join_room(data):
    room = data['room']
    join_room(room)
    emit('player_joined', {'player': data['player']}, room=room)
    print(f'Player {data["player"]} joined room {room}.')

# Handle game logic (e.g., dealing cards)
@socketio.on('deal_cards')
def handle_deal_cards(room):
    deck = list(range(1, 13)) * 4  # Simple example deck (1-12, 4 suits)
    random.shuffle(deck)
    emit('cards_dealt', {'cards': deck}, room=room)
    print(f'Cards dealt in room {room}.')

if __name__ == '__main__':
    socketio.run(app, debug=True)
