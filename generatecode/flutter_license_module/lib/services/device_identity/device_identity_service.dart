import 'device_identity_service_stub.dart'
    if (dart.library.io) 'device_identity_service_io.dart';

abstract class DeviceIdentityService {
  Future<String> getDeviceId();
}

DeviceIdentityService createDeviceIdentityService() => createDeviceIdentityServiceImpl();
