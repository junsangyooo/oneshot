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

    def set_player_num(self, num):
        self.player_num = num
    def get_player_num(self):
        return self.player_num

    def get_cards(self):
        return self.cards
    
    def place_cards(self, card, quantity):
        if self.cards[card] >= quantity:
            self.cards[card] -= quantity
        else: print(f'There isn\'t enough cards, {card.card_name}')

    # def recieve_cards(self, cards)
    
    def update_cards(self, cards):
        self.cards = cards
    
class Computer:
    def __init__(self, name, cards):
        self.name = name
        self.cards = cards
    def __str__(self):
        return(self.name)
    def __repr__(self):
        return(self.name)
    def place_cards(self, pre_card, quantity):
        return