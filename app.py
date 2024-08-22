# app.py

from flask import Flask, render_template, request, redirect, url_for
from flask_socketio import SocketIO, join_room, leave_room, send, emit
import random
import string

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'
socketio = SocketIO(app)

rooms = {}

# Generate a unique 6-character room code.
def generate_room_code():
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if code not in rooms:
            return code

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/start_game', methods=['POST'])
def start_game():
    player_name = request.form['playerName']
    game_type = request.form['gameType']

    if game_type == 'multiplayer':
        room_type = request.form['roomType']
        if room_type == 'create':
            room_code = generate_room_code()
            num_players = int(request.form['numPlayers'])
            rooms[room_code] = {
                'players': [player_name],
                'num_players': num_players,
                'game_started': False
            }
            return redirect(url_for('game', room=room_code, player=player_name))
        elif room_type == 'join':
            room_code = request.form['roomName']
            if room_code in rooms:
                rooms[room_code]['players'].append(player_name)
                if len(rooms[room_code]['players']) == rooms[room_code]['num_players']:
                    rooms[room_code]['game_started'] = True
                    socketio.emit('start_game', room=room_code)
                return redirect(url_for('game', room=room_code, player=player_name))
            else:
                return redirect(url_for('home'))
    else:
        # For single player game with computers (implementation can be added)
        return redirect(url_for('game', room='singleplayer', player=player_name))

@app.route('/game/<room>/<player>')
def game(room, player):
    return render_template('game.html', room=room, player=player)

@socketio.on('join')
def on_join(data):
    player_name = data['player']
    room = data['room']
    join_room(room)
    emit('player_joined', {'player': player_name}, room=room)

@socketio.on('play_card')
def on_play_card(data):
    room = data['room']
    player_name = data['player']
    card = data['card']
    # Add game logic to process the card play
    emit('card_played', {'player': player_name, 'card': card}, room=room)

@socketio.on('pass_turn')
def on_pass_turn(data):
    room = data['room']
    player_name = data['player']
    # Logic to handle passing the turn
    emit('turn_passed', {'player': player_name}, room=room)

if __name__ == '__main__':
    socketio.run(app, debug=True)
