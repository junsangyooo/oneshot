# app.py

from flask import Flask, render_template, request, redirect, url_for
from flask_socketio import SocketIO, join_room, leave_room, send, emit
import random
import string

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your_secret_key'
socketio = SocketIO(app)

# Dictionary to store game state
rooms = {}

def generate_room_code():
    """Generate a unique 6-character room code."""
    while True:
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))
        if code not in rooms:
            return code

def create_deck():
    """Create and shuffle a deck of cards."""
    # Create a deck with 1-12 in four suits, plus jokers (e.g., use numbers 1-12, with 1 being lowest)
    deck = list(range(1, 13)) * 4
    random.shuffle(deck)
    return deck

def deal_cards(deck, num_players):
    """Deal cards to players."""
    hands = [[] for _ in range(num_players)]
    for i in range(len(deck)):
        hands[i % num_players].append(deck[i])
    return hands

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
            deck = create_deck()
            hands = deal_cards(deck, num_players)
            rooms[room_code] = {
                'players': [player_name],
                'hands': {player_name: hands[0]},  # Add first player's hand
                'num_players': num_players,
                'current_turn': player_name,
                'game_started': False
            }
            return redirect(url_for('game', room=room_code, player=player_name))
        elif room_type == 'join':
            room_code = request.form['roomName']
            if room_code in rooms:
                room = rooms[room_code]
                room['players'].append(player_name)
                room['hands'][player_name] = room['hands'][len(room['players']) - 1]
                if len(room['players']) == room['num_players']:
                    room['game_started'] = True
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

    # Handle playing a card, check if it's valid
    if card in rooms[room]['hands'][player_name]:
        rooms[room]['hands'][player_name].remove(card)
        # Logic to determine the next player
        next_player = determine_next_player(room)
        rooms[room]['current_turn'] = next_player
        emit('card_played', {'player': player_name, 'card': card, 'next_player': next_player}, room=room)
    else:
        # Invalid card play
        emit('invalid_play', {'player': player_name, 'card': card}, room=room)

@socketio.on('pass_turn')
def on_pass_turn(data):
    room = data['room']
    player_name = data['player']
    next_player = determine_next_player(room)
    rooms[room]['current_turn'] = next_player
    emit('turn_passed', {'player': player_name, 'next_player': next_player}, room=room)

def determine_next_player(room):
    """Determine the next player's turn."""
    current_index = rooms[room]['players'].index(rooms[room]['current_turn'])
    next_index = (current_index + 1) % rooms[room]['num_players']
    return rooms[room]['players'][next_index]

if __name__ == '__main__':
    socketio.run(app, debug=True)
