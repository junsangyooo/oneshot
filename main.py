import pygame
from game import Game

def main():
    # Initialize Pygame
    pygame.init()

    # Screen dimensions
    SCREEN_WIDTH = 800
    SCREEN_HEIGHT = 600

    # Colors
    WHITE = (255, 255, 255)

    # Create screen
    screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
    pygame.display.set_caption("Dalmuti")

    # Create game instance
    player_names = ["Alice", "Bob", "Charlie", "Diana"]
    game = Game(player_names, screen)

    # Main game loop
    running = True
    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

        # Clear screen
        screen.fill(WHITE)

        # Update and display game state
        game.display_board()

        # Update display
        pygame.display.flip()

    # Quit Pygame
    pygame.quit()

if __name__ == '__main__':
    main()
