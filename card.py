class Card:
    def __init__(self, cardNum):
        self.cardNum = cardNum
    
    def __repr__(self):
        return f'Card({self.cardNum})'
