# app.py

from flask import Flask, render_template, request, redirect, url_for
from flask_socketio import SocketIO, emit, join_room, leave_room
import random

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'
socketio = SocketIO(app)

rooms = {}

def initialize_game(room, num_players):
    deck = list(range(1, 13)) * 4  # Simple deck (cards 1-12, 4 suits)
    random.shuffle(deck)
    rooms[room] = {
        'deck': deck,
        'players': [],
        'computers': [],
        'current_turn': None,
        'roles': {},
        'num_players': num_players
    }

@app.route('/')
def home():
    return render_template('home.html')

@app.route('/start_game', methods=['POST'])
def start_game():
    player_name = request.form['playerName']
    game_type = request.form['gameType']
    num_players = int(request.form['numPlayers'])

    if game_type == 'multiplayer':
        room = request.form['roomName']
        return redirect(url_for('game', room=room, player=player_name, num_players=num_players))
    else:
        room = "singleplayer"
        initialize_game(room, num_players)
        return redirect(url_for('game', room=room, player=player_name, num_players=num_players))

@app.route('/game/<room>/<player>/<num_players>')
def game(room, player, num_players):
    return render_template('game.html', room=room, player=player, num_players=num_players)

@socketio.on('create_room')
def handle_create_room(data):
    room = data['room']
    if room not in rooms:
        join_room(room)
        initialize_game(room, data['num_players'])
        rooms[room]['players'].append(data['player'])
        emit('room_created', {'room': room, 'player': data['player']}, room=room)
        print(f'Room {room} created by {data["player"]}.')
    else:
        join_room(room)
        rooms[room]['players'].append(data['player'])
        emit('player_joined', {'player': data['player']}, room=room)
        print(f'Player {data["player"]} joined room {room}.')

@socketio.on('start_game')
def handle_start_game(room):
    num_players = rooms[room]['num_players']
    if len(rooms[room]['players']) < num_players:
        num_computers = num_players - len(rooms[room]['players'])
        rooms[room]['computers'] = [f"Computer_{i+1}" for i in range(num_computers)]
        emit('add_computers', {'computers': rooms[room]['computers']}, room=room)
    
    emit('start_game', room=room)

@socketio.on('deal_cards')
def handle_deal_cards(room):
    deck = rooms[room]['deck']
    hands = {}
    num_players = len(rooms[room]['players']) + len(rooms[room]['computers'])
    
    for player in rooms[room]['players'] + rooms[room]['computers']:
        hands[player] = [deck.pop() for _ in range(len(deck) // num_players)]
    
    emit('cards_dealt', {'hands': hands}, room=room)
    print(f'Cards dealt in room {room}.')

@socketio.on('play_card')
def handle_play_card(data):
    room = d
