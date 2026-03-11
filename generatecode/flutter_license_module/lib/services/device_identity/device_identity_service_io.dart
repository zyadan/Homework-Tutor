import 'dart:io';

import 'device_identity_service.dart';

class _IoDeviceIdentityService implements DeviceIdentityService {
  @override
  Future<String> getDeviceId() async {
    return Platform.operatingSystem.toLowerCase();
  }
}

DeviceIdentityService createDeviceIdentityServiceImpl() => _IoDeviceIdentityService();
