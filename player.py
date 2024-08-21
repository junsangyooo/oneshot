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
    
    def use_card(self, card_rank, card_number):
        if self.cards[card_rank] >= card_number:
            self.cards[card_rank] -= card_number
        else: print("There isn't enough cards.")
    def update_cards(self, cards):
        self.cards = cards