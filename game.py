import random
from helper import *

class Game:
    def __init__(self, num_players):
        self.num_players = num_players
        self.deck = self.create_all_cards(num_players)
        self.hands = self.generate_cards_for_players()
        self.players = []
        self.current_turn = None
        self.current_round_cards = []
        self.first_game = True

    def create_all_cards(self):
        deck = []
        if self.num_players == 4:
            max_card_rank = 10
        elif self.num_players == 5:
            max_card_rank = 11
        else:
            max_card_rank = 12 
        
        for i in range(2): 
            deck.append(Card(0))  # Jester cards
        for rank in range(1, max_card_rank + 1):
            deck.extend([Card(rank) for _ in range(rank)])
        return deck

    def shuffle_deck(self):
        random.shuffle(self.deck)

    def generate_cards_for_players(self):
        self.shuffle_deck()
        card_num_per_player = len(self.deck) // self.num_players
        hands = [self.deck[i * card_num_per_player:(i + 1) * card_num_per_player] for i in range(self.num_players)]
        hands.append(self.deck[card_num_per_player * self.num_players:])
        return hands

    def add_player(self, player_name, is_computer=False):
        player_hand = self.hands[len(self.players)]
        player = Player(player_name, player_hand, is_computer)
        self.players.append(player)

    def play_card(self, player_name, card_rank, quantity):
        player = self.get_player(player_name)
        if card_rank in player.get_dict() and player.get_dict()[card_rank] > 0:
            player.get_dict()[card_rank] -= 1
            self.current_round_cards.append((player, card_rank))
            self.determine_next_player()
            return True
        else:
            return False

    def pass_turn(self, player_name):
        self.determine_next_player()

    def determine_next_player(self):
        current_index = self.players.index(self.current_turn)
        next_index = (current_index + 1) % self.num_players
        self.current_turn = self.players[next_index]

    def get_player(self, player_name):
        for player in self.players:
            if player.name == player_name:
                return player
        return None

    def is_round_over(self):
        return all(player.is_out_of_cards() for player, _ in self.current_round_cards)

    def reset_round(self):
        self.current_round_cards = []
        self.determine_next_player()
