CARD_NAMES = ["Jester", "Dalmuti", "Archbishop", "Earl Marshal", "Baroness", "Abbess", "Knight", "Seamstress", "Mason", "Cook", "Shepherdess", "Stonecutter", "Peasant"]
CARD_NUMBERS = [13, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
EMPTY_HAND_DICT = {i : 0 for i in range(1, 14)}

class Card:
    def __init__(self, card_rank):
        self.rank = card_rank
        self.name = CARD_NAMES[card_rank]

    def __str__(self):
        return(f'{self.rank}. {self.name}')
    
    def __repr__(self):
        return(f'{self.rank}. {self.name}')

    def get_rank(self):
        return self.rank
    def get_name(self):
        return self.name

class Player:
    def __init__(self, name, hand, is_computer) -> None:
        self.name = name
        self.hand = hand
        self.is_copmuter = is_computer
        self.set_dict(self.hand)

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
    def get_hand(self):
        return self.hand

    def set_dict(self, hand):
        self.dict = EMPTY_HAND_DICT
        for card in hand:
            self.dict[card.get_rank()] += 1
    def get_dict(self):
        return self.dict