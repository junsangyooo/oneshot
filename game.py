import random
from helper import *

class Game:
    def __init__(self, num_players):
        self.num_players = num_players
        self.deck = self.create_all_cards(num_players)
        self.players = []
        self.current_turn = 0
        self.current_round_cards = []
        self.current_round_quantity = 0
        self.current_round_winner = None
        self.first_game = True

    def shuffle_deck(self):
        random.shuffle(self.deck)
    def draw_a_card(self):
        card = self.deck.pop()
        return card
    def put_card_to_deck(self, card, card_list = None):
        if card_list is None:
            self.deck.add(card)
        else:
            self.deck.extend(card_list)

    def set_initial_ranks(self):
        # Shuffle a deck
        self.shuffle_deck()
        # Draw one card for each player
        initial_draw = [self.draw_a_card() for _ in range(self.num_players)]

        # Assign ranks based on the card drawn (lower rank is better)
        player_card_pairs = list(zip(self.players, initial_draw))
        player_card_pairs.sort(key=lambda x: x[1])

        # Assign ranks and reorder players based on the card drawn
        for rank, (player, card) in enumerate(player_card_pairs, start=1):
            player.set_player_rank(rank)

        # Reorder the players list based on their ranks
        self.players = [player for player, _ in player_card_pairs]

        # Put the initial_draw back to the deck
        self.put_card_to_deck(initial_draw)

        self.first_game = False
    
    def start_game(self):
        # There is not enough players
        if self.num_players is not len(self.players):
            print("Not enough players.")
            return
        
        # If the ranks for players is not set
        if self.first_game:
            self.set_initial_ranks()
        
        # Assign hands to each player
        self.generate_cards_for_players()

        # Start game by considering next player
        

    def create_all_cards(self):
        deck = []
        if self.num_players == 4:
            max_card_rank = 10
        elif self.num_players == 5:
            max_card_rank = 11
        else:
            max_card_rank = 12 
        
        for i in range(2): 
            deck.append(13)  # Jester cards
        for rank in range(1, max_card_rank + 1):
            deck.extend([rank for _ in range(rank)])
        return deck

    def generate_cards_for_players(self):
        self.shuffle_deck()
        card_num_per_player = len(self.deck) // self.num_players
        for i in range(self.num_players):
            self.players[i].set_hand(self.deck[i * card_num_per_player:(i + 1) * card_num_per_player])
        self.deck = self.deck[card_num_per_player * self.num_players:]

    def add_player(self, player_name, is_computer=False):
        player = Player(player_name, is_computer)
        self.players.append(player)
        if len(self.players) == self.num_players:
            self.start_game()

    def play_card(self, player_name, card_rank, quantity):
        player = self.get_player(player_name)
        if player.get_hand().count(card_rank) >= quantity:
            player.play_cards(card_rank, quantity)
            self.current_round_cards.append((player, card_rank, quantity))
            self.determine_next_player()
            return True
        print("You don't have enough cards")
        return False

    def pass_turn(self, player_name):
        player = self.get_player(player_name)
        player.set_passed(True)
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
