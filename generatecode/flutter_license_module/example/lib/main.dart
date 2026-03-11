import 'package:flutter/material.dart';
import 'package:flutter_license_module/flutter_license_module.dart';

void main() {
  runApp(const LicenseModuleExample());
}

class LicenseModuleExample extends StatefulWidget {
  const LicenseModuleExample({super.key});

  @override
  State<LicenseModuleExample> createState() => _LicenseModuleExampleState();
}

class _LicenseModuleExampleState extends State<LicenseModuleExample> {
  final _baseUrlController = TextEditingController(text: 'http://127.0.0.1:9000'); //'http://10.0.2.2:9000'
  final _adminTokenController = TextEditingController(text: 'test-admin');

  @override
  void dispose() {
    _baseUrlController.dispose();
    _adminTokenController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'License Module Example',
      theme: ThemeData(
        colorSchemeSeed: const Color(0xFF0B6E4F),
        useMaterial3: true,
      ),
      home: Builder(
        builder: (context) => Scaffold(
          body: SafeArea(
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                Text(
                  '激活码模块示例',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 8),
                const Text('先填调试参数，再进入生成码和激活页面。'),
                const SizedBox(height: 16),
                TextField(
                  controller: _baseUrlController,
                  decoration: const InputDecoration(
                    labelText: 'baseUrl',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _adminTokenController,
                  decoration: const InputDecoration(
                    labelText: 'adminToken',
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () {
                    Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => LicenseDemoApp(
                          baseUrl: _baseUrlController.text.trim(),
                          adminToken: _adminTokenController.text.trim(),
                        ),
                      ),
                    );
                  },
                  child: const Text('进入模块 Demo'),
                ),
                const SizedBox(height: 16),
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text('建议参数'),
                        SizedBox(height: 8),
                        Text('Android 模拟器: http://10.0.2.2:9000'),
                        Text('桌面/iOS 模拟器: http://127.0.0.1:9000'),
                        Text('adminToken: test-admin'),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
