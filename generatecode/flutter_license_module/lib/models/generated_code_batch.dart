class GeneratedLicenseItem {
  final String tokenId;
  final String code;

  const GeneratedLicenseItem({
    required this.tokenId,
    required this.code,
  });

  factory GeneratedLicenseItem.fromJson(Map<String, dynamic> json) {
    return GeneratedLicenseItem(
      tokenId: json['tokenId'] as String? ?? json['token_id'] as String? ?? '',
      code: json['code'] as String? ?? '',
    );
  }
}

class GeneratedCodeBatch {
  final int count;
  final int durationDays;
  final String? batchId;
  final String? startTokenId;
  final String? endTokenId;
  final List<GeneratedLicenseItem> items;

  const GeneratedCodeBatch({
    required this.count,
    required this.durationDays,
    required this.batchId,
    required this.startTokenId,
    required this.endTokenId,
    required this.items,
  });

  factory GeneratedCodeBatch.fromJson(Map<String, dynamic> json) {
    final items = (json['items'] as List<dynamic>? ?? const <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map(GeneratedLicenseItem.fromJson)
        .toList();

    return GeneratedCodeBatch(
      count: _parseInt(json['count'], fallback: items.length),
      durationDays: _parseInt(json['durationDays'] ?? json['duration_days'], fallback: 30),
      batchId: json['batchId'] as String?,
      startTokenId: json['startTokenId'] as String? ?? json['start_token_id'] as String?,
      endTokenId: json['endTokenId'] as String? ?? json['end_token_id'] as String?,
      items: items,
    );
  }

  static int _parseInt(Object? value, {required int fallback}) {
    if (value is num) {
      return value.toInt();
    }
    if (value is String) {
      return int.tryParse(value.trim()) ?? fallback;
    }
    return fallback;
  }
}
