class Card:
    def __init__(self, rank):
        self.rank = rank
    
    def __repr__(self):
        return f'Card({self.rank})'
