import random
from helper import *

# Create a deck
def create_all_cards(num_of_players=8):
    deck = []

    if num_of_players==4:
        max_card_rank = 10
    elif num_of_players==5:
        max_card_rank = 11
    else:
        max_card_rank = 12

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
def list_to_dict(cards):
    dict = {}
    for card in cards: 
        if card in dict:
            dict[card]+=1
        else:
            dict[card] = 1
    return dict

# Convert a dict of cards to a list
def dict_to_list(dict):
    cards = []
    for key, value in dict.items():
        for num_of_cards in range(value):
            cards.append(key)
    return cards

# Generate list of cards for players
def generate_cards_for_players(deck, num_of_players=8):
    hands = []
    card_num_per_player = len(deck) // num_of_players
    deck = shuffle(deck)
    for player_number in range(num_of_players):
        hands.append(deck[card_num_per_player * player_number: card_num_per_player * player_number + card_num_per_player])
    
    # Now append the remaining cards
    hands.append(deck[num_of_players * card_num_per_player:])

    return hands