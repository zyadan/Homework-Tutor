import 'device_identity_service.dart';

class _StubDeviceIdentityService implements DeviceIdentityService {
  @override
  Future<String> getDeviceId() async => 'unknown-platform';
}

DeviceIdentityService createDeviceIdentityServiceImpl() => _StubDeviceIdentityService();
