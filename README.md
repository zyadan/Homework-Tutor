# Homework-Tutor

## install flutter
Step 1 安装
```
sudo snap install flutter --classic
```
Step 2 加 PATH（snap通常自动加，但建议检查）
```￼
echo $PATH
```
如果没有：

/snap/bin

就加：
```
echo 'export PATH=$PATH:/snap/bin' >> ~/.bashrc
source ~/.bashrc
```
Step 3 验证
```
flutter --version
flutter doctor
```


### 
mock 数据现在存在哪
默认在：
/home/zyadan/Learning/generatecode/fc_license_service/.mock-license-store.json

.mock-license-store.json
第一次你生成激活码后，这个文件就会出现。

如果你想换文件名
可以这样启动：

MOCK_DATA_FILE=./custom-mock-store.json DATA_PROVIDER=mock ADMIN_TOKEN=test-admin PORT=9000 npm start

目前要启动example
```
cd /home/zyadan/Learning/generatecode/fc_license_service
DATA_PROVIDER=mock ADMIN_TOKEN=test-admin PORT=9000 npm start
```
另一个终端用代码测试
测试方式示例
生成激活码：
```
curl -X POST http://127.0.0.1:9000/admin/generateCodes \
  -H "Content-Type: application/json" \
  -H "x-admin-token: test-admin" \
  -d '{
    "count": 3,
    "durationDays": 30,
    "prefix": "VIP",
    "batchId": "TEST_BATCH_001",
    "remark": "manual api test"
  }'

```
激活：
```
curl -X POST http://127.0.0.1:9000/license/activate \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "linux",
    "code": "VIP-ABCD-EFGH-JKLM"
  }'

```
校验：
```
curl -X POST http://127.0.0.1:9000/license/verify \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "linux",
    "code": "VIP-ABCD-EFGH-JKLM"
  }'

```

调用UI
```
cd /Learning/generatecode/flutter_license_module/example
flutter run -d linux
```

## 用在阿里云上

本地的代码
最简单的打包方式
在 license_gene_service 目录执行：
```
npm install --omit=dev
zip -r license_gene_service.zip app.js index.js config.js package.json README.md routes services utils node_modules
```

生成激活码
```
curl -X POST 'https://license-service-rnpmijlttd.cn-hangzhou.fcapp.run/admin/generateCodes' \
  -H 'Content-Type: application/json' \
  -H 'x-admin-token: test-admin' \
  -d '{
    "count": 2,
    "durationDays": 30,
    "prefix": "VIP",
    "batchId": "FC_TEST_004"
  }'
```
激活
```
curl -X POST 'https://license-service-rnpmijlttd.cn-hangzhou.fcapp.run/license/activate' \
  -H 'Content-Type: application/json' \
  -d '{
    "code": "VIP-CCNR-PQQH-27QS"
  }'
```
验证
```
curl -X POST 'https://license-service-rnpmijlttd.cn-hangzhou.fcapp.run/license/verify' \
  -H 'Content-Type: application/json' \
  -d '{
    "code": "VIP-CCNR-PQQH-27QS"
  }'

```



