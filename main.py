import random
from card import Card
from player import Player
from game import Game
    
# Go back to main
def go_back_to_main(): return

# Create a deck
def create_all_cards(max_card_rank=12):
    deck = []

    # Add two Jester cards into the deck
    for i in range(2): deck.append(Card(0))
    # Add all other cards into the deck 
    for card_rank in range(1, max_card_rank + 1):
        for card_number in range(card_rank):
            deck.append(Card(card_rank))
    
    return deck

# Shuffle a deck of cards
def shuffle(deck):
    random.shuffle(deck)
    return deck

# Convert a list of cards to a dict
def list_to_dict(deck):
    dict = {}
    for card in deck: 
        if card in dict:
            dict[card]+=1
        else:
            dict[card] = 1
    return dict

# Generate list of cards for players
def generate_cards_for_players(num_of_players=8):
    if num_of_players==4:
        max_card_rank = 10
    elif num_of_players==5:
        max_card_rank = 11
    else:
        max_card_rank = 12

    cards = []
    card_num_per_player = 80 // num_of_players
    deck = shuffle(create_all_cards(max_card_rank))
    for player_number in range(num_of_players):
        cards.append(deck[card_num_per_player * player_number: card_num_per_player * player_number + card_num_per_player])
    
    # Now append the remaining cards
    cards.append(deck[num_of_players * card_num_per_player:])

    return cards

num_of_players = 8
cards = generate_cards_for_players(num_of_players)
players = []
for player_num in range(num_of_players):
    players.append(Player(f'Player {num_of_players + 1}', cards))

player_names = input("Please indicates the names of players(Player1,Player2,...)").split(',')
num_of_players = len(player_names)
cards = generate_cards_for_players(num_of_players)
players = []
for player_num in range(num_of_players):
    players.append(Player(player_names[player_num], cards))