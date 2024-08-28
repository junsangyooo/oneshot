import random
from helper import *

class Game:
    def __init__(self, num_players):
        self.num_players = num_players
        self.deck = self.create_all_cards(num_players)
        self.players = []
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
            self.set_initial_ranks()
            self.start_game()

    def pay_tax(self, player, number):
        hand = player.get_hand()
        hand.sort(reverse=True)
        tax = [hand.pop() for _ in range(number)]
        player.set_hand(hand)
        return tax
        
    def check_revolution(self):
        for i, player in enumerate(self.players):
            if player.get_hand().count(13) == 2:
                if bool(input("Do you want to start a revolution?(True/False)")):
                    if i == self.num_players - 1:
                        return "Greater Revolution"
                    else:
                        return "Revolution"
                return "None"
        return "None"

    def tax_collection(self):
        # First, collect tax from the last player
        collector = self.players[0]
        payer = self.players[-1]
        tax = self.pay_tax(payer, 2)
        new_hand = collector.get_hand().extend(tax)
        refund = []
        for _ in range(2):
            card = int(input(f"Which card do you want to give to {payer}?\n{new_hand}"))
            new_hand.remove(card)
            refund.append(card)
        collector.set_hand(new_hand)
        payer.set_hand(payer.get_hand().extend(refund))

        # collect tax from the second_to_last player
        collector = self.players[1]
        payer = self.players[-2]
        tax = self.pay_tax(payer, 1)
        new_hand = collector.get_hand().extend(tax)
        refund = int(input(f"Which card do you want to give to {payer}?\n{new_hand}"))
        new_hand.remove(refund)
        collector.set_hand(new_hand)
        payer.set_hand(payer.get_hand().append(refund))

    def greater_revolution(self):
        self.players.reverse()

    def start_game(self):
        # Assign hands to each player
        self.generate_cards_for_players()

        # Collect taxes
        if not self.first_game:
            revolution = self.check_revolution()
            if revolution == "Greater Revolution":
                self.greater_revolution()
                self.tax_collection()
            elif revolution == "None":
                self.tax_collection()
        
        new_round = True
        current_turn = 0
        placed_cards = []
        current_round_card_quantity = 0
        new_players_list = []
        # Start a game
        while(len(new_players_list) < self.num_players):
            # each round
            survived = self.num_players
            while(True):
                # If only on player survived, the round is ended
                if survived == 1:
                    self.deck.extend(placed_cards)
                    new_round = True
                    survived = self.num_players
                    for player in self.players:
                        player.set_passed(False)
                    continue

                player = self.players[current_turn]

                # If the player pass, we consider next player
                passed = bool(input(f"{player}: {player.get_hand()}\nDo you want to pass the current round?(True/False)"))
                if passed:
                    current_turn = self.pass_turn()
                    survived -= 1
                    continue
                
                while(True):
                    if new_round:
                        order = input(f"{player}: {player.get_hand()}\nChoose cards to place(card_number,quantity)").split(',')
                        card = int(order[0])
                        current_round_card_quantity = int(order[1])
                    else:
                        card = int(input(f"{player}: {player.get_hand()}\nChoose cards to place."))
                    
                    if player.play_cards(card, current_round_card_quantity):
                        for _ in range(current_round_card_quantity):
                            placed_cards.append(card)
                        current_turn = self.determine_next_player()
                        break
                    print("You don't have enough cards.")


    def play_card(self, card_rank, quantity):
        player = self.players[self.current_turn]
        if player.get_hand().count(card_rank) >= quantity:
            player.play_cards(card_rank, quantity)
            for _ in range(quantity):
                self.current_round_cards.append(card_rank)
            # self.current_round_cards.append((player, card_rank, quantity))
            self.determine_next_player()
            return True
        print("You don't have enough cards")
        return False

    def pass_turn(self, current_turn):
        player = self.players[current_turn]
        player.set_passed(True)
        return self.determine_next_player(current_turn)

    def determine_next_player(self, current_turn):
        next_turn = (current_turn + 1) % self.num_players
        while(self.players[next_turn].get_passed()):
            if next_turn == current_turn: return current_turn
            next_turn = (current_turn + 1) % self.num_players
        return next_turn

    def get_player(self, player_name):
        for player in self.players:
            if player.name == player_name:
                return player
        return None