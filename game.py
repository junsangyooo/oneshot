import random
import pygame
from card import Card
from player import Player

class Game:
    def __init__(self, player_names, screen):
        self.players = [Player(name) for name in player_names]
        self.player_num = len(player_names)

        # Define the card deck
        self.deck = [Card(13)] * 2
        if self.player_num == 4:
            for cardNum in range(1, 11): self.deck += [Card(cardNum)] * cardNum
        elif self.player_num == 5:
            for cardNum in range(1, 12): self.deck += [Card(cardNum)] * cardNum
        else:
            for cardNum in range(1, 13): self.deck += [Card(cardNum)] * cardNum
        random.shuffle(self.deck)

        self.turn = 0
        self.current_round = 0
        self.screen = screen
        self.load_card_images()

    def load_card_images(self):
        self.card_images = {}
        for rank in range(1, 14):
            self.card_images[rank] = pygame.image.load(f'assets/{rank}.png')

    def display_card(self, card, position):
        self.screen.blit(self.card_images[card.rank], position)

    def assign_roles_first_round(self):
        initial_cards = [self.deck.pop() for _ in self.players]
        sorted_players = sorted(zip(initial_cards, self.players), key=lambda x: x[0].rank)
        for i, (_, player) in enumerate(sorted_players):
            player.role = self.roles[i]
    
    def assign_roles_following_rounds(self):
        self.players.sort(key=lambda p: p.role)
        for i, player in enumerate(self.players):
            player.role = self.roles[i]
    
    def deal_cards(self):
        for player in self.players:
            player.hand = []
        while self.deck:
            for player in self.players:
                if self.deck:
                    player.receive_card(self.deck.pop())
    
    def start_round(self):
        self.deal_cards()
        # 혁명 체크와 카드 교환 로직 추가 필요
        # 게임 플레이 로직 추가 필요
    
    def play_game(self):
        self.assign_roles_first_round()
        self.start_round()
        
        while True:
            self.current_round += 1
            print(f"Round {self.current_round} 시작!")
            self.start_round()

            self.display_board()
            # 각 라운드의 플레이 로직과 결과 처리
            # ...

            continue_game = input("다음 라운드를 진행하시겠습니까? (y/n): ")
            if continue_game.lower() != 'y':
                break

        print("게임이 종료되었습니다.")

    def display_board(self):
        # Clear screen
        self.screen.fill((255, 255, 255))
        
        # Display players and their hands
        for i, player in enumerate(self.players):
            x = 100
            y = 50 + i * 100
            for card in player.hand:
                self.display_card(card, (x, y))
                x += 30
        
        # Update display
        pygame.display.flip()
