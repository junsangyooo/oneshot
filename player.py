class Player:
    def __init__(self, name):
        self.name = name
        self.hand = {}
        self.rank = 0
        self.passed = False
        self.finished = False
    
    def receive_card(self, card):
        self.hand[card] += 1
    
    def play_card(self, card, numOfCard):
        if self.hand[card] >= numOfCard:
            self.hand[card] -= numOfCard
            return True
        return False
    
    def getRank(self): return self.rank

    def getPassed(self): return self.passed

    def getfinished(self): return self.finished
    
    def __repr__(self):
        return f'Player({self.name}, Hand: {self.hand}, Role: {self.rank})'
