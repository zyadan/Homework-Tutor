import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/token_global_state.dart';
import '../services/license_api.dart';

class LicenseStateNotifier extends StateNotifier<TokenGlobalState?> {
  LicenseStateNotifier(this._api) : super(null);

  final LicenseApi _api;

  bool get hasValidLicense {
    final current = state;
    return current != null && current.activated && !current.isExpired;
  }

  Future<TokenGlobalState> refresh({
    required String deviceId,
    String? tokenId,
    String? code,
  }) async {
    final next = await _api.verify(
      tokenId: tokenId,
      deviceId: deviceId,
      code: code,
    );
    state = next;
    return next;
  }

  Future<TokenGlobalState> activate({
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
