CARD_NAMES = ["Jester", "Dalmuti", "Archbishop", "Earl Marshal", "Baroness", "Abbess", "Knight", "Seamstress", "Mason", "Cook", "Shepherdess", "Stonecutter", "Peasant"]

class Card:
    def __init__(self, card_rank):
        self.card_rank = card_rank
        self.card_name = CARD_NAMES[card_rank]

    def __str__(self):
        return(f'{self.card_rank}. {self.card_name}')
    
    def __repr__(self):
        return(f'{self.card_rank}. {self.card_name}')