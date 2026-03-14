# Flutter License Module

这是一个可复用的 Flutter 授权模块，包含：

- 激活码生成页面
- Token 激活页面
- Token 授权状态模型
- Token 授权接口
- 管理员生成激活码接口
- 可直接运行的 example

## 目录

- `lib/flutter_license_module.dart`: 导出入口
- `lib/demo_app.dart`: 模块宿主页
- `lib/pages/admin_generate_codes_page.dart`: 生成激活码页面
- `lib/pages/license_activation_page.dart`: Token 激活页面
- `example/lib/main.dart`: 可直接运行的示例入口

## 依赖

```yaml
dependencies:
  flutter_riverpod: ^2.6.1
  http: ^1.3.0
```

## 直接运行 example

1. 先启动 Node.js 本地服务

```bash
cd /home/zyadan/Learning/generatecode/fc_license_service
DATA_PROVIDER=mock ADMIN_TOKEN=test-admin PORT=9000 npm start
```

2. 再运行 Flutter example

```bash
cd /home/zyadan/Learning/generatecode/flutter_license_module
flutter pub get
flutter run -t example/lib/main.dart
```

3. 进入页面后填写参数

- Android 模拟器: `http://10.0.2.2:9000`
- 桌面或 iOS 模拟器: `http://127.0.0.1:9000`
- `adminToken`: `test-admin`
- `tokenId`: `u1001`
- `deviceId`: `android-001`

4. 点击 `进入模块 Demo`

你会看到两个页签：

- `生成激活码`
- `Token 激活`

## 生成激活码页面可以做什么

- 填数量、天数、前缀、批次号、备注
- 点击 `生成激活码`
- 页面直接回显激活码列表
- 单个复制激活码
- 一键复制全部激活码

## 接入自己的 Flutter 工程

如果不是运行 example，而是接入自己的项目：

1. 引入模块文件
2. 创建 `LicenseApi` 和 `LicenseAdminApi`
3. 打开 `LicenseDemoApp` 或单独复用页面组件

导出入口：

```dart
import 'package:flutter_license_module/flutter_license_module.dart';
```
