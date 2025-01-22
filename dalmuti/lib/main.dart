// import 'dart:ffi';

import 'package:flutter/material.dart';
// import 'game_components.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  // This widget is the root of your application.
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: '',
      home: ClickCounterScreen(),
    );
  }
}

class ClickCounterScreen extends StatefulWidget {
  @override
  State<ClickCounterScreen> createState() => _ClickCounterScreen();
}

class _ClickCounterScreen extends State<ClickCounterScreen> {
  int count = 0;

  void _increment(){
    setState(() {
      count++;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text("Counter"),
      ),
      body: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text(
            "You clicked",
            style: TextStyle(fontSize: 20),
          ),
          Text(
            '$count',
            style: TextStyle(fontSize: 36, fontWeight: FontWeight.bold),
          ),
          Text(
            'number of times.',
            style: TextStyle(fontSize: 20),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: _increment,
        tooltip: "Increment",
        child: Icon(Icons.add),
      ),
    );
  }
}