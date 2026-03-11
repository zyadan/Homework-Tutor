# Activation License Module

适用于 `Flutter + Kotlin` App 的独立激活码授权模块。

当前后端实现：`Node.js + 阿里云 Function Compute + Tablestore`

## 当前业务规则

- 后端生成激活码时，自动生成内部用户 ID，例如 `U000001`
- 每个激活码和一个内部用户 ID 一一对应
- 用户激活时不输入用户 ID
- Flutter 端自动采集当前设备类型并上传，例如 `android / ios / linux`
- 当前字段名仍为 `deviceId`，但示例里实际存的是设备类型
- 设备类型当前只做记录和回显，不作为拦截授权的判断条件

## mock 与正式环境

### mock 模式

- `DATA_PROVIDER=mock`
- 现在会把数据持久化到：`fc_license_service/.mock-license-store.json`
- 即使你重启 `npm start`，用户 ID 序列和激活码也会继续保留

### 正式环境

- `DATA_PROVIDER=tablestore`
- 用户 ID 序列保存在 `system_meta` 表
- 激活码和授权状态保存在 `activation_codes / user_license / activation_logs`

## 本地启动

```bash
cd /home/zyadan/Learning/generatecode/fc_license_service
npm install
DATA_PROVIDER=mock ADMIN_TOKEN=test-admin PORT=9000 npm start
```

如需改 mock 文件路径：

```bash
MOCK_DATA_FILE=./custom-mock-store.json DATA_PROVIDER=mock ADMIN_TOKEN=test-admin PORT=9000 npm start
```

## Flutter example

```bash
cd /home/zyadan/Learning/generatecode/flutter_license_module/example
flutter pub get
flutter run -d linux
```

## 说明

- 当前 example 会自动识别设备类型，例如 `linux / android / ios`
- 如果后续你又想恢复“按设备限制”，那时再接 Kotlin 原生唯一设备 ID 更合适
