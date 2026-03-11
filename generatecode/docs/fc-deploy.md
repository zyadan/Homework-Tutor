# 阿里云 Function Compute 部署步骤

本文档对应当前目录下的 `fc_license_service` Node.js 服务。

## 一、准备工作

你需要准备：

- 阿里云 `Function Compute`
- 阿里云 `Tablestore`
- 一个可用的 `RAM` 子账号 `AccessKey`
- 本地电脑安装 `Node.js 18+`

建议：

- 不要使用主账号 `AccessKey`
- 给 `RAM` 子账号只开当前函数和当前 Tablestore 实例的最小权限

## 二、Tablestore 建表

按 [tablestore-schema.md](/home/zyadan/Learning/generatecode/docs/tablestore-schema.md:1) 创建三张表：

- `activation_codes`
- `user_license`
- `activation_logs`

主键：

- `activation_codes.code`
- `user_license.user_id`
- `activation_logs.log_id`

## 三、本地安装依赖

进入后端目录：

```bash
cd /home/zyadan/Learning/generatecode/fc_license_service
```

安装依赖：

```bash
npm install
```

## 四、本地 mock 测试

先不要连云，先本地跑通：

```bash
DATA_PROVIDER=mock ADMIN_TOKEN=test-admin PORT=9000 npm start
```

服务启动后地址：

```text
http://127.0.0.1:9000
```

先执行生成激活码：

```bash
curl -X POST http://127.0.0.1:9000/admin/generateCodes \
  -H "Content-Type: application/json" \
  -H "x-admin-token: test-admin" \
  -d '{
    "count": 5,
    "durationDays": 30,
    "prefix": "VIP",
    "batchId": "LOCAL_BATCH_001"
  }'
```

然后拿返回的任一激活码执行激活：

```bash
curl -X POST http://127.0.0.1:9000/license/activate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "u1001",
    "deviceId": "android-001",
    "code": "VIP-XXXX-XXXX-XXXX"
  }'
```

再校验：

```bash
curl -X POST http://127.0.0.1:9000/license/verify \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "u1001",
    "deviceId": "android-001"
  }'
```

## 五、切换到 Tablestore

准备环境变量：

```bash
export DATA_PROVIDER=tablestore
export OTS_ENDPOINT='https://<instance>.<region>.ots.aliyuncs.com'
export OTS_INSTANCE_NAME='your-instance'
export OTS_ACCESS_KEY_ID='your-ak'
export OTS_ACCESS_KEY_SECRET='your-sk'
export ACTIVATION_TABLE='activation_codes'
export USER_LICENSE_TABLE='user_license'
export ACTIVATION_LOG_TABLE='activation_logs'
export ADMIN_TOKEN='your-admin-token'
export DEFAULT_SUB_ROLE='normal'
export DEFAULT_DURATION_DAYS='30'
```

本地直接连接云表测试：

```bash
npm start
```

这一步成功后，再部署到 FC。

## 六、创建 Function Compute 函数

在阿里云控制台中：

1. 进入 `函数计算 FC`
2. 创建应用或服务
3. 新建 `HTTP 函数`
4. 运行时选择 `Node.js 20`
5. 代码上传当前 `fc_license_service` 目录内容
6. 入口函数填写：`src/app.handler`
7. 环境变量填入上面的 `Tablestore` 配置

## 七、配置 HTTP Trigger

创建 HTTP Trigger 后，确保允许：

- `POST /admin/generateCodes`
- `POST /license/activate`
- `POST /license/verify`
- `GET /user/status`

如果你后续绑定自定义域名，Flutter 端只要改 `baseUrl`。

## 八、Flutter 联调参数

本地联调时：

- `baseUrl = http://10.0.2.2:9000` Android 模拟器
- `baseUrl = http://127.0.0.1:9000` iOS 模拟器或桌面
- `adminToken = test-admin`

云端联调时：

- `baseUrl = https://你的函数域名`
- `adminToken = 你配置的 ADMIN_TOKEN`

## 九、上线前检查

上线前至少确认：

- 管理员接口有 `x-admin-token`
- `AK/SK` 只存在于 FC 环境变量
- Flutter 包中没有云凭证
- `deviceId` 获取逻辑稳定
- 激活成功后能重复校验
- 设备不匹配时能正确拒绝
