import 'package:flutter/material.dart';

final Map<int, String> cards = {1: "Dalmuti", 2:"Archbishop", 3: "Earl Marshal", 4: "Baroness", 5: "Abbess", 6: "Knight", 
              7: "Seamstress", 8: "Mason", 9: "Cook", 10: "Shepherdess", 11: "Stonecutter", 12: "Peasant", 13: "Jester"};

class Card {
  final int rank;
  final Image img;

  Card(this.rank, this.img);
  Card.unlaunched(int rank) : this(rank, Image.asset('assets/${cards[rank]}.png'));

  Image getImage(){
    return img;
  }
}

class Player {
  final String name;
  bool isComputer;
  int curRank;
  List<Card> hand;

  Player(this.name, this.isComputer, this.curRank, this.hand);
  Player.unlaunched(String name) : this(name, false, 0, []);

  void setRank(int n) {
    curRank = n;
  }
  int getRank() {
    return curRank;
  }
  void setHand(List<Card> deck){
    hand = deck;
  }
  List<Card> getHand(){
    return hand;
  }
  void playCard(Card card){
    hand.remove(card);
  }
}