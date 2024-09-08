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

    def shuffle_deck(self):
        random.shuffle(self.deck)
    def draw_a_card(self):
        card = self.deck.pop()
        return card
    def put_a_card_to_deck(self, card):
        self.deck.append(card)
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
                if bool(input("Do you want to start a revolution?(True/False)")):
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
                card = int(input(f"Which card do you want to give to a payer?\n{hand}"))
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
            if card is not 13: return card
        return 13

    def determine_next_player(self, players, current_turn, new_round = False):
        num_players = len(players)
        if new_round:
            for _ in range(num_players):
                if players[current_turn].get_finished():
                    current_turn = (current_turn + 1) % num_players
                else: break
            return current_turn
        for _ in range(num_players):
            if players[current_turn].get_finished() or players[current_turn].get_passed():
                current_turn = (current_turn + 1) % num_players
            else: break
        return current_turn

    def computer_play(self, player, pre_card, quantity):
        hand = player.get_hand()
        # Consider the hand which doesn't contain jester cards
        jester_num = hand.count(13)
        hand_wo_jester = hand
        for _ in range(jester_num): hand_wo_jester.remove(13)
        
        # If the hand contains only jester cards
        if jester_num is len(hand):
            # If it is the first turn on the round
            if quantity is 0:
                return hand
            else: return None

        # If the hand contains duplicates of only one card except jester
        if len(hand_wo_jester) is hand_wo_jester.count(hand_wo_jester[0]):
            # If it is the first turn on the round
            if quantity is 0:
                return hand
            # If the card in hand is lower than previous card
            if hand_wo_jester[0] < pre_card:
                # If there are alreay enough cards
                if len(hand_wo_jester) >= quantity:
                    return [hand_wo_jester[0]] * quantity
                # Else if # of card + # of jester staisfies the quantity
                elif len(hand_wo_jester) + jester_num >= quantity:
                    while len(hand_wo_jester) < quantity: hand_wo_jester.append(13)
                    return hand_wo_jester
            # Else, there are no cards to be placed
            return None
        
        # If it is the first turn on the round
        if quantity is 0:
            max_card = max(hand_wo_jester)
            return [max_card] * hand.count(max_card)
        
        # Now we can assure there is a previous card and multiple different cards are in the hand
        # We only consider the cards where their quantity + jester_num >= quantity
        for card in range(12, 0, -1):
            # If the card is lower than the previous card and it is in the hand
            if card < pre_card and card in hand:
                # If there are alreay enough cards
                if hand.count(hand) >= quantity:
                    return [card] * quantity
                # Else if # of card + # of jester staisfies the quantity
                elif hand.count(card) + jester_num >= quantity:
                    return [card] * hand.count(hand) + [13] * (quantity - hand.count(card))
        
        # If nothing returned yet, we know there is no valid card to play
        return None
        
    def set_new_losers(self, losers):
        for player in losers:
            if player.get_finished():
                losers.remove(player)
        return losers
    
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
            elif bool(input(f"{player}, do you want a draw a card?(True/False)")):
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

        return
        
        current_turn = 0
        placed_cards = []
        current_round_card_quantity = 0
        winners = []
        pre_card = 14
        losers = self.players
        # Start a game
        # loop each round
        while(len(winners) < self.num_players):
            print(f"New round started.")
            print(losers)
            last_played_player = current_turn
            # loop each turn
            while(True):
                player = losers[current_turn]
                order = []

                if current_round_card_quantity is not 0:
                    print(f"Previous card: {pre_card}")

                # If the player is a computer
                if player.get_is_computer():
                    order = self.computer_play(player, pre_card, current_round_card_quantity)
                # Now we know the player is not a computer
                else:
                    # If the player wants to pass, we consider next player
                    passed = bool(input(f"{player}: {player.get_hand()}\nDo you want to pass the current round?(True/False)"))
                    if not passed:
                        # Now ask player for the cards to place
                        while(True):
                            if current_round_card_quantity == 0:
                                order = [int(card) for card in input(f"{player}: {player.get_hand()}\nChoose cards to place.(card,card,card,...)").split(',')]
                                if not player.check_cards(order):
                                    print("You don't have enough cards.")
                                    continue
                                current_round_card_quantity = len(order)
                            else:
                                order = [int(card) for card in input(f"{player}: {player.get_hand()}\nChoose cards to place.(card,card,card,...)").split(',')]
                                if len(order) is not current_round_card_quantity:
                                    print("The number of cards you want to place is not proper for this round.")
                                    continue
                                if not player.check_cards(order):
                                    print("You don't have enough cards.")
                                    continue
                                if self.get_card_num(order) >= pre_card:
                                    print("Your card should be smaller than the previous card.")
                                    continue
                            break
                
                # if the order is empty, it means the computer passed the turn
                if not order:
                    player.set_passed(True)
                    next_turn = self.determine_next_player(losers, current_turn)
                    print(f"{player} passed.")
                    # This case is when the lsat played player is finished and all other player cannot play more
                    if next_turn is current_turn:
                        next_player = losers[self.determine_next_player(losers, last_played_player, True)]
                        losers = self.set_new_losers(losers)
                        for i, player in enumerate(losers):
                            if player is next_player:
                                current_turn = i
                                break
                    break
                        
                # We know the order is valid so place the order
                player.play_cards(order)
                placed_cards.extend(order)
                pre_card = self.get_card_num(order)
                last_played_player = current_turn

                # If the player finished the hand
                if player.is_finished():
                    winners.append(player)
                    player.set_finished(True)
                next_turn = self.determine_next_player(losers, current_turn)
                if next_turn is current_turn:
                    if player.get_finished():
                        next_player = losers[self.determine_next_player(losers, current_turn, True)]
                        losers = self.set_new_losers(losers)
                        for i, player in enumerate(losers):
                            if player is next_player:
                                current_turn = i
                                break
                        break
                    break
                        

            self.put_cards_to_deck(placed_cards)
            current_round_card_quantity = 0
            placed_cards = []
            pre_card = 14
            for player in losers:
                player.set_passed(False)

        self.players = winners
        print(f"New player rank is: {self.players}")


game = Game(4)
game.add_player("Jun")
game.add_player("Computer 1", True)
game.add_player("Computer 4", True)
game.add_player("Computer 3", True)