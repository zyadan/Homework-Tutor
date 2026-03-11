import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/user_global_state.dart';

class LicenseApi {
  LicenseApi({required this.baseUrl, http.Client? client})
      : _client = client ?? http.Client();

  final String baseUrl;
  final http.Client _client;

  Future<UserGlobalState> activate({
    required String deviceId,
    required String code,
  }) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/license/activate'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({
        'deviceId': deviceId,
        'code': code.trim().toUpperCase(),
      }),
    );

    return _parseState(response);
  }

  Future<UserGlobalState> verify({
    required String deviceId,
    String? userId,
    String? code,
  }) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/license/verify'),
      headers: {'content-type': 'application/json'},
      body: jsonEncode({
        'userId': userId,
        'deviceId': deviceId,
        'code': code?.trim().toUpperCase(),
      }),
    );

    return _parseState(response);
  }

  UserGlobalState _parseState(http.Response response) {
    final Map<String, dynamic> json = jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw LicenseApiException(json['message'] as String? ?? 'license api failed');
    }
    return UserGlobalState.fromJson(json);
  }

  void dispose() {
    _client.close();
  }
}

class LicenseApiException implements Exception {
  LicenseApiException(this.message);

  final String message;

  @override
  String toString() => 'LicenseApiException: $message';
}
