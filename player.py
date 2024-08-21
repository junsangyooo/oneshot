from card import Card



class Player:
    def __init__(self, name, cards) -> None:
        self.name = name
        self.cards = cards
    def __str__(self):
        return(self.name)
    def __repr__(self):
        return(self.name)

    def get_cards(self):
        return self.cards
    
    def place_cards(self, card, quantity):
        if self.cards[card] >= quantity:
            self.cards[card] -= quantity
        else: print(f'There isn\'t enough cards, {card.card_name}')

    # def recieve_cards(self, cards)
    
    def update_cards(self, cards):
        self.cards = cards