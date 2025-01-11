# app.py

from flask import Flask, render_template, request, redirect, url_for
from flask_socketio import SocketIO, join_room, leave_room, send, emit
from game_cli import Game
import random, string

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'
socketio = SocketIO(app)

rooms = {}

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
            game = Game(num_players)
            game.add_player(player_name)
            rooms[room_code] = game
            return redirect(url_for('game', room=room_code, player=player_name))
        elif room_type == 'join':
            room_code = request.form['roomName']
            if room_code in rooms:
                game = rooms[room_code]
                game.add_player(player_name)
                if len(game.players) == game.num_players:
                    socketio.emit('start_game', room=room_code)
                return redirect(url_for('game', room=room_code, player=player_name))
            else:
                return redirect(url_for('home'))
    else:
        # Single-player game with unique room code
        room_code = generate_room_code()  # Generate a unique room code for single-player
        num_players = int(request.form['numPlayers'])
        game = Game(num_players)
        game.add_player(player_name)
        for i in range(1, num_players):
            game.add_player(f'Player {i}', is_computer=True)
        rooms[room_code] = game
        return redirect(url_for('game', room=room_code, player=player_name))

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
    card_rank = data['card_rank']

    game = rooms[room]
    if game.play_card(player_name, card_rank):
        emit('card_played', {'player': player_name, 'card_rank': card_rank, 'next_player': game.current_turn.name}, room=room)
        if game.is_round_over():
            game.reset_round()
            emit('round_over', room=room)
    else:
        emit('invalid_play', {'player': player_name, 'card_rank': card_rank}, room=room)

@socketio.on('pass_turn')
def on_pass_turn(data):
    room = data['room']
    player_name = data['player']
    game = rooms[room]
    game.pass_turn(player_name)
    emit('turn_passed', {'player': player_name, 'next_player': game.current_turn.name}, room=room)

if __name__ == '__main__':
    socketio.run(app, debug=True)

