import 'package:flutter/material.dart';

final Map<int, String> CARD_NAMES = {1: "Dalmuti", 2:"Archbishop", 3: "Earl Marshal", 4: "Baroness", 5: "Abbess", 6: "Knight", 
              7: "Seamstress", 8: "Mason", 9: "Cook", 10: "Shepherdess", 11: "Stonecutter", 12: "Peasant", 13: "Jester"}
/workspaces/The-Great-Dalmuti/assets/Cook.png
class Card {
  final int rank;
  final Image img;

  Card(this.rank, this.img)
  Card.unlaunched(int rank) : this(rank, Image.asset('../assets/${CARD_NAMES[rank]}.png/'));
}

class Hand {
  List<Card>
}

class Player {
  final String name;
  bool isComputer;
  Hand hand;
  int? curRank;

  Player(this.name, this.isComputer, this.hand);
  Player.unlaunched(String name) : this(name, false, Hand());
}