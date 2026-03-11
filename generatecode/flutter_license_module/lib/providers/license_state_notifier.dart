import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/user_global_state.dart';
import '../services/license_api.dart';

class LicenseStateNotifier extends StateNotifier<UserGlobalState?> {
  LicenseStateNotifier(this._api) : super(null);

  final LicenseApi _api;

  bool get hasValidLicense {
    final current = state;
    return current != null && current.activated && !current.isExpired;
  }

  Future<UserGlobalState> refresh({
    required String deviceId,
    String? userId,
    String? code,
  }) async {
    final next = await _api.verify(
      userId: userId,
      deviceId: deviceId,
      code: code,
    );
    state = next;
    return next;
  }

  Future<UserGlobalState> activate({
    required String deviceId,
    required String code,
  }) async {
    final next = await _api.activate(
      deviceId: deviceId,
      code: code,
    );
    state = next;
    return next;
  }

  void clear() {
    state = null;
  }
}
