class Player:
    def __init__(self, name):
        self.name = name
        self.hand = []
        self.role = None
    
    def receive_card(self, card):
        self.hand.append(card)
    
    def play_card(self, card):
        if card in self.hand:
            self.hand.remove(card)
            return card
        return None
    
    def __repr__(self):
        return f'Player({self.name}, Hand: {self.hand}, Role: {self.role})'
