class TokenGlobalState {
  final String tokenId;
  final String subRole;
  final int remainDays;
  final int expireAtMillis;
  final bool activated;
  final String deviceId;
  final String licenseStatus;
  final String? activatedCode;

  const TokenGlobalState({
    required this.tokenId,
    required this.subRole,
    required this.remainDays,
    required this.expireAtMillis,
    required this.activated,
    required this.deviceId,
    required this.licenseStatus,
    this.activatedCode,
  });

  bool get isExpired =>
      DateTime.now().millisecondsSinceEpoch >= expireAtMillis || !activated;

  TokenGlobalState copyWith({
    String? tokenId,
    String? subRole,
    int? remainDays,
    int? expireAtMillis,
    bool? activated,
    String? deviceId,
    String? licenseStatus,
    String? activatedCode,
  }) {
    return TokenGlobalState(
      tokenId: tokenId ?? this.tokenId,
      subRole: subRole ?? this.subRole,
      remainDays: remainDays ?? this.remainDays,
      expireAtMillis: expireAtMillis ?? this.expireAtMillis,
      activated: activated ?? this.activated,
      deviceId: deviceId ?? this.deviceId,
      licenseStatus: licenseStatus ?? this.licenseStatus,
      activatedCode: activatedCode ?? this.activatedCode,
    );
  }

  factory TokenGlobalState.fromJson(Map<String, dynamic> json) {
    return TokenGlobalState(
      tokenId: json['tokenId'] as String? ?? json['token_id'] as String? ?? '',
      subRole: json['subRole'] as String? ?? json['sub_role'] as String? ?? 'normal',
      remainDays: _parseInt(json['remainDays'] ?? json['remain_days']),
      expireAtMillis: _parseTimestamp(json['expireAt'] ?? json['expire_at']),
      activated: _parseBool(json['active'] ?? json['activated']),
      deviceId: json['deviceId'] as String? ?? json['device_id'] as String? ?? '',
      licenseStatus: json['licenseStatus'] as String? ?? json['license_status'] as String? ?? 'not_found',
      activatedCode: json['activatedCode'] as String? ?? json['activated_code'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'tokenId': tokenId,
      'subRole': subRole,
      'remainDays': remainDays,
      'expireAt': expireAtMillis,
      'active': activated,
      'deviceId': deviceId,
      'licenseStatus': licenseStatus,
      'activatedCode': activatedCode,
    };
  }

  static int _parseInt(Object? value) {
    if (value is num) {
      return value.toInt();
    }
    if (value is String) {
      return int.tryParse(value.trim()) ?? 0;
    }
    return 0;
  }

  static int _parseTimestamp(Object? value) {
    if (value is num) {
      return value.toInt();
    }
    if (value is String) {
      final trimmed = value.trim();
      final parsedInt = int.tryParse(trimmed);
      if (parsedInt != null) {
        return parsedInt;
      }
      final parsedDateTime = DateTime.tryParse(trimmed);
      if (parsedDateTime != null) {
        return parsedDateTime.millisecondsSinceEpoch;
      }
    }
    return 0;
  }

  static bool _parseBool(Object? value) {
    if (value is bool) {
      return value;
    }
    if (value is num) {
      return value != 0;
    }
    if (value is String) {
      switch (value.trim().toLowerCase()) {
        case 'true':
        case '1':
        case 'yes':
        case 'y':
          return true;
        default:
          return false;
      }
    }
    return false;
  }
}
