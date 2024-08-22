CARD_NAMES = {1: "Dalmuti", 2:"Archbishop", 3: "Earl Marshal", 4: "Baroness", 5: "Abbess", 6: "Knight", 
              7: "Seamstress", 8: "Mason", 9: "Cook", 10: "Shepherdess", 11: "Stonecutter", 12: "Peasant", 13: "Jester"}

class Player:
    def __init__(self, name, hand, is_computer) -> None:
        self.name = name
        self.hand = hand
        self.is_copmuter = is_computer
        self.passed = False

    def __str__(self):
        return(self.name)
    def __repr__(self):
        return(self.name)

    def is_computer(self):
        return self.is_computer
    
    def set_player_rank(self, num):
        self.player_rank = num
    def get_player_rank(self):
        return self.player_rank

    def set_hand(self, hand):
        self.hand = hand
        self.set_dict(self.hand)
    def get_hand(self):
        return self.hand
    
    def play_cards(self, card, quantity):
        if self.hand.count(card) >= quantity:
            for _ in range(quantity):
                self.hand.remove(card)
                
    def set_passed(self, passed):
        self.passed = passed
    def get_passed(self):
        return self.passed
