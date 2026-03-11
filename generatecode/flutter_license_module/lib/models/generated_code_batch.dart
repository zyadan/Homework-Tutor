class GeneratedLicenseItem {
  final String userId;
  final String code;

  const GeneratedLicenseItem({
    required this.userId,
    required this.code,
  });

  factory GeneratedLicenseItem.fromJson(Map<String, dynamic> json) {
    return GeneratedLicenseItem(
      userId: json['userId'] as String? ?? '',
      code: json['code'] as String? ?? '',
    );
  }
}

class GeneratedCodeBatch {
  final int count;
  final int durationDays;
  final String? batchId;
  final String? startUserId;
  final String? endUserId;
  final List<GeneratedLicenseItem> items;

  const GeneratedCodeBatch({
    required this.count,
    required this.durationDays,
    required this.batchId,
    required this.startUserId,
    required this.endUserId,
    required this.items,
  });

  factory GeneratedCodeBatch.fromJson(Map<String, dynamic> json) {
    final items = (json['items'] as List<dynamic>? ?? const <dynamic>[])
        .whereType<Map<String, dynamic>>()
        .map(GeneratedLicenseItem.fromJson)
        .toList();

    return GeneratedCodeBatch(
      count: (json['count'] as num?)?.toInt() ?? items.length,
      durationDays: (json['durationDays'] as num?)?.toInt() ?? 30,
      batchId: json['batchId'] as String?,
      startUserId: json['startUserId'] as String?,
      endUserId: json['endUserId'] as String?,
      items: items,
    );
  }
}
