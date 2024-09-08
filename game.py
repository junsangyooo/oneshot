import random
from player import *

# Game:
#   - num_players
#   - deck
#   - players
#   - first_game
#   - 


class Game:
    def __init__(self, num_players):
        self.num_players = num_players
        self.deck = self.create_all_cards()
        self.players = []
        self.first_game = True
        # Variables for game process
        self.current_player_index = 0
        self.round_quantity = 0
        self.placed_cards = []
        self.previous_card = 14
        self.last_player_index = 0

    def shuffle_deck(self):
        random.shuffle(self.deck)
    def draw_a_card(self):
        card = self.deck.pop()
        return card
    def put_cards_to_deck(self, card_list):
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
        self.put_cards_to_deck(initial_draw)

        print(f"New rank: {self.players}")
        print(f"Lengh of deck: {len(self.deck)}\nThe deck: {self.deck}")

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

    def print_player_hands(self):
        for player in self.players:
            hand = player.get_hand()
            hand.sort()
            print(f"{player}'s hand: {hand}")
    
    def print_deck(self):
        print(self.deck)

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
            print(f"All players joined the game. Now we set the initial ranks.")
            self.set_initial_ranks()
            print(f"Now we start a game.")
            self.start_game()
          
    def check_revolution(self):
        for i, player in enumerate(self.players):
            hand = player.get_hand()
            if hand.count(13) == 2:
                if player.get_is_computer():
                    if i > 1:
                        if i == self.num_players - 1:
                            return "Greater Revolution"
                        return "Revolution"
                    return None
                if bool(input("Do you want to start a revolution?(True/False)\n")):
                    if i == self.num_players - 1:
                        return "Greater Revolution"
                    else:
                        return "Revolution"
                return "None"
        return "None"

    def greater_revolution(self):
        self.players.reverse()

    def refund_tax(self, player, number):
        hand = player.get_hand()
        refund = []
        if player.get_is_computer():
            hand.sort()
            jester_num = hand.count(13)
            for _ in range(jester_num):
                hand.remove(13)
            refund = [hand.pop() for _ in range(number)]
            for _ in range(jester_num):
                hand.append(13)
        else:
            while len(refund) < number:
                card = int(input(f"Which card do you want to give to a payer?\nYour hand: {hand}\n"))
                if card in hand:
                    hand.remove(card)
                    refund.append(card)
                else:
                    print("The card is not in your hand.")
        player.set_hand(hand)
        return refund    
    
    def tax_collection(self, collector, payer, number):
        collector_hand = collector.get_hand()
        payer_hand = payer.get_hand()

        # Get the tax
        payer_hand.sort(reverse=True)
        tax = [payer_hand.pop() for _ in range(number)]
        # Add the tax to the collector's hand
        collector_hand.extend(tax)
        collector.set_hand(collector_hand)
        # Get the refund
        refund = self.refund_tax(collector, number)
        # Add the refund to the payer's hand
        payer_hand.extend(refund)
        payer.set_hand(payer_hand)

    def get_card_num(self, order):
        for card in order:
            if card != 13: return card
        return 13

    def determine_next_player(self):
        if not self.players[self.last_player_index].get_finished():
            self.current_player_index = self.last_player_index
            return
        index = (self.last_player_index + 1) % self.num_players
        while index != self.last_player_index:
            if not self.players[index].get_finished():
                self.current_player_index = index
                return

    def computer_play(self):
        player = self.players[self.current_player_index]
        hand = player.get_hand()
        
        # If the hand contains only jester cards
        jester_num = hand.count(13)
        if jester_num is len(hand):
            # If it is the first turn on the round
            if self.round_quantity == 0:
                return hand
            else: return []

        # Now we can assure that there is a previous card and round_quantity is set
        for card in range(12, 0, -1):
            if card not in hand:
                continue
            # If it is the first turn on the round
            if self.round_quantity == 0:
                return [card] * hand.count(card)
            # Check if the card is valid to play
            if card < self.previous_card:
                num_card = hand.count(card)
                if num_card >= self.round_quantity:
                    return [card] * self.round_quantity
                elif num_card + jester_num >= self.round_quantity:
                    return [card] * num_card + [13] * (self.round_quantity - num_card)
        return []
        
    def all_passed(self):
        for player in self.players:
            if not player.get_passed() and not player.get_finished():
                return False
        return True

    def get_cards_to_play(self):
        player = self.players[self.current_player_index]
        order = []
        if self.round_quantity == 0:
            order = [int(card) for card in input(f"{player}: {player.get_hand()}\nChoose cards to place.(card,card,card,...)\n").split(',')]
        else:
            # Check whether the player wants to plass
            passed = bool(input(f"{player}, do you want a pass?(True/False)\nYour hand: {player.get_hand()}\nPrevious card: {self.previous_card}, Quantity: {self.round_quantity}\n"))
            if passed: return []
            order = [int(card) for card in input(f"{player}: {player.get_hand()}\nPrevious card: {self.previous_card}, Quantity: {self.round_quantity}\nChoose cards to place.(card,card,card,...)\n").split(',')]

        if self.round_quantity != 0 and len(order) != self.round_quantity and self.get_card_num(order) >= self.previous_card:
            return self.get_cards_to_play()
        if player.check_cards(order):
            return order
        return self.get_cards_to_play()

    def run_a_round(self):
        winners = []
        print("New round started.")

        # iterate each turn
        while(True):
            # Set the base case of the round
            if self.all_passed(): break
            player = self.players[self.current_player_index]
            if player.get_passed() or player.get_finished():
                self.current_player_index = (self.current_player_index + 1) % self.num_players
                continue
            
            # Now we know the player is playing the game
            order = []
            # If the player is computer
            if player.get_is_computer():
                order = self.computer_play()
            # If it is the first turn on the round
            else:
                order = self.get_cards_to_play()

            # If order is None, pass the turn
            if order is None:
                player.set_passed(True)
                self.current_player_index = (self.current_player_index + 1) % self.num_players
                continue
            
            # Now this means player placed the cards and it's valid
            player.play_cards(order)
            self.last_player_index = self.current_player_index
            self.placed_cards.extend(order)
            self.round_quantity = len(order)
            self.previous_card = self.get_card_num(order)
            self.current_player_index = (self.current_player_index + 1) % self.num_players

            # If the player finished his hand
            if player.is_finished():
                player.set_finished(True)
                winners.append(player)

        return winners
    
    def start_game(self):
        # Assign hands to each player
        self.generate_cards_for_players()

        self.print_player_hands()
        self.print_deck()

        # If there are leftover cards
        player_index = 0
        while self.deck:
            player = self.players[player_index]
            if player.get_is_computer():
                card = self.draw_a_card()
                hand = player.get_hand()
                hand.append(card)
                player.set_hand(hand)
            elif bool(input(f"{player}, do you want a draw a card?(True/False)\n")):
                card = self.draw_a_card()
                hand = player.get_hand()
                hand.append(card)
                player.set_hand(hand)
            player_index = (player_index + 1) % self.num_players
        self.print_player_hands()

        # Revolution
        revolution = self.check_revolution()
        if revolution == "Greater Revolution":
            self.greater_revolution()

        # Collect taxes
        if not self.first_game and revolution != "Revolution":
            self.tax_collection(self.players[0], self.players[-1], 2)
            self.tax_collection(self.players[1], self.players[-2], 1)
            
        self.print_player_hands()

        self.first_game = False

        # Start a game
        # loop each round
        winners = []
        while(len(winners) < self.num_players):
            # Run a round and get the winners from the round
            new_winners = self.run_a_round()
            winners.extend(new_winners)
            self.determine_next_player()

            # Put back the placed cards to the deck
            self.put_cards_to_deck(self.placed_cards)

            # Set game variables for the new round
            self.placed_cards = []
            self.round_quantity = 0
            self.previous_card = 14

        self.players = winners
        self.current_player_index = 0
        self.last_player_index = 0
        print(f"New player rank is: {self.players}")
    
    def after_game_ended(self):
        new_game = False
        for player in self.players:
            if not player.get_is_computer():
                play_again = bool(input(f"Do you want to play again?(True/False)\n"))
                if play_again:
                    new_game = True
                    continue
                player.set_is_computer(True)
        if new_game:
            self.start_game()


game = Game(4)
game.add_player("Jun")
game.add_player("Computer 1", True)
game.add_player("Computer 4", True)
game.add_player("Computer 3", True)