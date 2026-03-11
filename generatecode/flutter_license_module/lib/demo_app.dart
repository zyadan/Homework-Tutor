import 'package:flutter/material.dart';

import 'pages/admin_generate_codes_page.dart';
import 'pages/license_activation_page.dart';
import 'providers/license_state_notifier.dart';
import 'services/license_admin_api.dart';
import 'services/license_api.dart';

class LicenseDemoApp extends StatefulWidget {
  const LicenseDemoApp({
    super.key,
    required this.baseUrl,
    required this.adminToken,
  });

  final String baseUrl;
  final String adminToken;

  @override
  State<LicenseDemoApp> createState() => _LicenseDemoAppState();
}

class _LicenseDemoAppState extends State<LicenseDemoApp> {
  late final LicenseApi _licenseApi;
  late final LicenseAdminApi _licenseAdminApi;
  late final LicenseStateNotifier _notifier;

  @override
  void initState() {
    super.initState();
    _licenseApi = LicenseApi(baseUrl: widget.baseUrl);
    _licenseAdminApi = LicenseAdminApi(
      baseUrl: widget.baseUrl,
      adminToken: widget.adminToken,
    );
    _notifier = LicenseStateNotifier(_licenseApi);
  }

  @override
  void dispose() {
    _licenseApi.dispose();
    _licenseAdminApi.dispose();
    _notifier.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('激活码模块 Demo'),
          bottom: const TabBar(
            tabs: [
              Tab(text: '生成激活码'),
              Tab(text: '用户激活'),
            ],
          ),
        ),
        body: TabBarView(
          children: [
            AdminGenerateCodesPage(api: _licenseAdminApi),
            LicenseActivationPage(notifier: _notifier),
          ],
        ),
      ),
    );
  }
}
