from collections import Counter

CARD_NAMES = {1: "Dalmuti", 2:"Archbishop", 3: "Earl Marshal", 4: "Baroness", 5: "Abbess", 6: "Knight", 
              7: "Seamstress", 8: "Mason", 9: "Cook", 10: "Shepherdess", 11: "Stonecutter", 12: "Peasant", 13: "Jester"}

class Player:
    def __init__(self, name, is_computer = False) -> None:
        self.name = name
        self.is_computer = is_computer
        self.passed = False
        self.finished = False

    def __str__(self):
        return(self.name)
    def __repr__(self):
        return(self.name)

    def get_is_computer(self):
        return self.is_computer
    
    def set_player_rank(self, num):
        self.player_rank = num
    def get_player_rank(self):
        return self.player_rank

    def set_hand(self, hand):
        self.hand = hand
    def get_hand(self):
        return self.hand
    
    def check_cards(self, cards):
        if 13 in cards:
            if self.hand.count(13) < cards.count(13): return False
            for _ in range(cards.count(13)):
                cards.remove(13)
        if cards.count(cards[0]) is not len(cards): return False
        if self.hand.count(cards[0]) < len(cards): return False
        return True
    def play_cards(self, cards):
        for card in cards:
            self.hand.remove(card)
                
    def set_passed(self, passed):
        self.passed = passed
    def get_passed(self):
        return self.passed
    def is_finished(self):
        return not self.hand
    def set_finished(self, finished):
        self.finished = finished
    def get_finished(self):
        return self.finished
    
    def new_game(self, rank):
        self.set_player_rank(rank)
        self.set_passed(False)
        self.set_hand([])
