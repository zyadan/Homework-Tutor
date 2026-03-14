import 'package:flutter/material.dart';

import '../providers/license_state_notifier.dart';
import '../services/device_identity/device_identity_service.dart';

class LicenseActivationPage extends StatefulWidget {
  const LicenseActivationPage({
    super.key,
    required this.notifier,
  });

  final LicenseStateNotifier notifier;

  @override
  State<LicenseActivationPage> createState() => _LicenseActivationPageState();
}

class _LicenseActivationPageState extends State<LicenseActivationPage>
    with AutomaticKeepAliveClientMixin {
  final TextEditingController _codeController = TextEditingController();
  final DeviceIdentityService _deviceIdentityService = createDeviceIdentityService();
  bool _loading = false;
  String? _error;
  String _deviceId = 'detecting-platform';

  @override
  void initState() {
    super.initState();
    _loadDeviceId();
  }

  Future<void> _loadDeviceId() async {
    final String deviceId = await _deviceIdentityService.getDeviceId();
    if (!mounted) {
      return;
    }
    setState(() {
      _deviceId = deviceId;
    });
  }

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _activate() async {
    final String code = _codeController.text.trim();

    if (_deviceId.isEmpty || _deviceId == 'detecting-platform') {
      setState(() {
        _error = 'Platform is still being detected';
      });
      return;
    }
    if (code.isEmpty) {
      setState(() {
        _error = 'Please enter activation code';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await widget.notifier.activate(
        deviceId: _deviceId,
        code: code,
      );
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Activation success')),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  Future<void> _verify() async {
    final String code = _codeController.text.trim();
    final currentState = widget.notifier.state;

    if (_deviceId.isEmpty || _deviceId == 'detecting-platform') {
      setState(() {
        _error = 'Platform is still being detected';
      });
      return;
    }
    if (code.isEmpty) {
      setState(() {
        _error = 'Please enter activation code';
      });
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      await widget.notifier.refresh(
        deviceId: _deviceId,
        tokenId: currentState?.tokenId,
        code: code,
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final state = widget.notifier.state;
    final List<Widget> children = <Widget>[
      Card(
        child: ListTile(
          title: const Text('Current device type'),
          subtitle: SelectableText(_deviceId),
        ),
      ),
      const SizedBox(height: 16),
      TextField(
        controller: _codeController,
        decoration: const InputDecoration(
          labelText: 'activation code',
          hintText: 'VIP-XXXX-XXXX-XXXX',
          border: OutlineInputBorder(),
        ),
      ),
      const SizedBox(height: 16),
      Row(
        children: <Widget>[
          Expanded(
            child: FilledButton(
              onPressed: _loading ? null : _activate,
              child: Text(_loading ? 'Processing...' : 'Activate'),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: OutlinedButton(
              onPressed: _loading ? null : _verify,
              child: const Text('Verify'),
            ),
          ),
        ],
      ),
    ];

    if (_error != null) {
      children.add(const SizedBox(height: 12));
      children.add(Text(_error!, style: const TextStyle(color: Colors.red)));
    }

    if (state != null) {
      children.add(const SizedBox(height: 24));
      children.add(Text('internalTokenId: ${state.tokenId}'));
      children.add(Text('deviceType: ${state.deviceId}'));
      children.add(Text('status: ${state.licenseStatus}'));
      children.add(Text('role: ${state.subRole}'));
      children.add(Text('remainDays: ${state.remainDays}'));
      children.add(
        Text('expireAt: ${DateTime.fromMillisecondsSinceEpoch(state.expireAtMillis)}'),
      );
    }

    return Scaffold(
      appBar: AppBar(title: const Text('License Activation')),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: ListView(
          children: children,
        ),
      ),
    );
  }

  @override
  bool get wantKeepAlive => true;
}
