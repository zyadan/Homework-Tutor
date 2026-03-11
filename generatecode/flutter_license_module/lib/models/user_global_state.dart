class UserGlobalState {
  final String userId;
  final String subRole;
  final int remainDays;
  final int expireAtMillis;
  final bool activated;
  final String deviceId;
  final String licenseStatus;
  final String? activatedCode;

  const UserGlobalState({
    required this.userId,
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

  UserGlobalState copyWith({
    String? userId,
    String? subRole,
    int? remainDays,
    int? expireAtMillis,
    bool? activated,
    String? deviceId,
    String? licenseStatus,
    String? activatedCode,
  }) {
    return UserGlobalState(
      userId: userId ?? this.userId,
      subRole: subRole ?? this.subRole,
      remainDays: remainDays ?? this.remainDays,
      expireAtMillis: expireAtMillis ?? this.expireAtMillis,
      activated: activated ?? this.activated,
      deviceId: deviceId ?? this.deviceId,
      licenseStatus: licenseStatus ?? this.licenseStatus,
      activatedCode: activatedCode ?? this.activatedCode,
    );
  }

  factory UserGlobalState.fromJson(Map<String, dynamic> json) {
    return UserGlobalState(
      userId: json['userId'] as String? ?? '',
      subRole: json['subRole'] as String? ?? 'normal',
      remainDays: (json['remainDays'] as num?)?.toInt() ?? 0,
      expireAtMillis: (json['expireAt'] as num?)?.toInt() ?? 0,
      activated: json['active'] as bool? ?? false,
      deviceId: json['deviceId'] as String? ?? '',
      licenseStatus: json['licenseStatus'] as String? ?? 'not_found',
      activatedCode: json['activatedCode'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'userId': userId,
      'subRole': subRole,
      'remainDays': remainDays,
      'expireAt': expireAtMillis,
      'active': activated,
      'deviceId': deviceId,
      'licenseStatus': licenseStatus,
      'activatedCode': activatedCode,
    };
  }
}
