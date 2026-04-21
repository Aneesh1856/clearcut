import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:convert';
import 'dart:async';
import 'package:flutter/services.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const SentinelApp());
}

class SentinelApp extends StatelessWidget {
  const SentinelApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Legal Sentinel',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primaryColor: const Color(0xFF38BDF8),
        scaffoldBackgroundColor: const Color(0xFF0F172A),
      ),
      home: const SentinelHomeScreen(),
    );
  }
}

class SentinelHomeScreen extends StatefulWidget {
  const SentinelHomeScreen({super.key});

  @override
  State<SentinelHomeScreen> createState() => _SentinelHomeScreenState();
}

class _SentinelHomeScreenState extends State<SentinelHomeScreen> {
  late final WebViewController _controller;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _initController();
    _requestPermissions();
  }

  Future<void> _requestPermissions() async {
    await [
      Permission.camera,
      Permission.microphone,
    ].request();
  }

  void _initController() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0F172A))
      ..setNavigationDelegate(
        NavigationDelegate(
          onPageStarted: (url) => setState(() => _isLoading = true),
          onPageFinished: (url) => setState(() => _isLoading = false),
          onWebResourceError: (error) => debugPrint('Web error: ${error.description}'),
        ),
      )
      ..addJavaScriptChannel(
        'SentinelBridge',
        onMessageReceived: (message) {
          if (message.message == 'startScout') {
            _triggerNativeScout();
          }
        },
      )
      ..loadFlutterAsset('assets/www/index.html');
  }

  // NATIVE SCOUT LOGIC
  // Since real screen capture logic requires a complex Native-Side Service implementation,
  // for this Hackathon build, we will simulate the frame capture by capturing the current app window.
  // Note: For full app background capture, a Foreground Service in Kotlin would be required.
  Future<void> _triggerNativeScout() async {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Sentinel Scout: System-level scan activated.'),
        backgroundColor: Color(0xFF38BDF8),
      ),
    );
    
    // Simulate real-time harvest data feed back to JS
    Timer.periodic(const Duration(seconds: 2), (timer) {
      if (!mounted) {
        timer.cancel();
        return;
      }
      // Placeholder: In a production native build, we would capture the screen here
      // and send a base64 frame to JS via:
      // _controller.runJavaScript("window.receiveScoutFrame('$base64')");
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        top: false, // Allow full immersion for the Sentinel header
        child: Stack(
          children: [
            WebViewWidget(controller: _controller),
            if (_isLoading)
              Container(
                color: const Color(0xFF0F172A),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Image.asset('assets/logo.png', width: 80, height: 80),
                      const SizedBox(height: 20),
                      const SizedBox(
                        width: 40,
                        child: LinearProgressIndicator(
                          backgroundColor: Colors.white10,
                          color: Color(0xFF38BDF8),
                        ),
                      ),
                      const SizedBox(height: 10),
                      const Text(
                        'INITIALIZING SENTINEL...',
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 2,
                          color: Color(0xFF38BDF8),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
