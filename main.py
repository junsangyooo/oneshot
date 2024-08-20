import random

CARD_NAMES = ["Jester", "Dalmuti", "Archbishop", "Earl Marshal", "Baroness", "Abbess", "Knight", "Seamstress", "Mason", "Cook", "Shepherdess", "Stonecutter", "Peasant"]
CARD_NUMBERS = [13, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

class Card:
    def __init__(self, card_rank):
        self.card_rank = card_rank
        self.card_name = CARD_NAMES[card_rank]

    def __str__(self):
        return(f'{self.card_rank}. {self.card_name}')
    
    def __repr__(self):
        return(f'{self.card_rank}. {self.card_name}')

class Player:
    def __init__(self, name, cards) -> None:
        self.name = name
        self.cards = cards
    def __str__(self):
        return(self.name)
    def __repr__(self):
        return(self.name)

    def get_cards(self):
        return self.cards
    
    def use_card(self, card_rank, card_number):
        if self.cards[card_rank] >= card_number:
            self.cards[card_rank] -= card_number
        else: print("There isn't enough cards.")
    def update_cards(self, cards):
        self.cards = cards
    
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

    players = []
    card_num_per_player = 80 // num_of_players
    deck = shuffle(create_all_cards(max_card_rank))
    for player_number in range(num_of_players):
        begin = card_num_per_player * player_number
        end = begin + card_num_per_player
        cards = list_to_dict(deck[begin:end])
        players.append(Player(f'Player{player_number + 1}', cards))
    
    remaining_cards = deck[num_of_players * card_num_per_player:]