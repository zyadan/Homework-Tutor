import 'dart:convert';

import 'package:http/http.dart' as http;

import '../models/generated_code_batch.dart';

class LicenseAdminApi {
  LicenseAdminApi({
    required this.baseUrl,
    required this.adminToken,
    http.Client? client,
  }) : _client = client ?? http.Client();

  final String baseUrl;
  final String adminToken;
  final http.Client _client;

  Future<GeneratedCodeBatch> generateCodes({
    required int count,
    required int durationDays,
    required String prefix,
    String? batchId,
    String? remark,
  }) async {
    final response = await _client.post(
      Uri.parse('$baseUrl/admin/generateCodes'),
      headers: {
        'content-type': 'application/json',
        'x-admin-token': adminToken,
      },
      body: jsonEncode({
        'count': count,
        'durationDays': durationDays,
        'prefix': prefix,
        'batchId': batchId,
        'remark': remark,
      }),
    );

    final Map<String, dynamic> json =
        jsonDecode(response.body) as Map<String, dynamic>;
    if (response.statusCode >= 400) {
      throw LicenseAdminApiException(
        json['message'] as String? ?? 'generate codes failed',
      );
    }

    return GeneratedCodeBatch.fromJson(json);
  }

  void dispose() {
    _client.close();
  }
}

class LicenseAdminApiException implements Exception {
  LicenseAdminApiException(this.message);

  final String message;

  @override
  String toString() => 'LicenseAdminApiException: $message';
}
