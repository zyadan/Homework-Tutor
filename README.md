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

##阿里云要建立步骤
A. 账号准备

1. 注册阿里云账号

2. 完成实名认证

3. 开通 Function Compute
    1) 开通 Function Compute
    2) 进入函数计算控制台
    3) 创建一个服务
    4) 再创建一个函数
       创建web函数- HTTp接口类型 - 运行环境 Node.js 18 - 上传方式（通过zip包上传） - 函数的触发器里面选用无需认证，那里面有一个网址，就是后面Flutter用来访问的地址 - 如果在线上改了代码，要点击部署才会用
    6) 运行环境选 Node.js
       
4. 开通 Tablestore
    Tablestore 有 VCU 模式 和 CU 模式 两种计费模式， 测试阶段用CU模式
    运行环境选 Node.js
    这里面选用 网络管理- 勾线公网 - 不勾选 允许来源类型  可信网关(控制台)
   
6. 创建 RAM 用户和 AccessKey。（记住AccessKey ID, AccessKey Secret）
   进去RAm控制台 -  创建RAM用户 - 访问方式（编程访问，不要勾选控制台访问）（本地开发环境使用） - 给RAM用户授权 - 创建AccessKey
   添加权限：
      AliyunOTSFullAccess 
      AliyunFCFullAccess

B. 存储准备

1. 创建 Tablestore 实例

2. 选好地域 （我们选华东1 -杭州），tablestore实例和FC的函数要在一个地域

3. 创建 四个表。
   activation_codes 主键： code String
   token_license 主键： token_id String
   activation_logs 主键： log_id String
   system_meta 主键： meta_key String

C. 后端部署

    整理 Node.js 代码
    把本地 json 读写换成 Tablestore 读写
    在 FC 创建 Node.js 函数


配置环境变量
    FC控制台-找到你的函数-配置环境变量
    ALIYUN_ACCESS_KEY_ID
    ALIYUN_ACCESS_KEY_SECRET
    OTS_INSTANCE_NAME
    OTS_ENDPOINT

配置 HTTP 入口。

D. 测试

  先在 FC 控制台测试
  再接 Flutter。


# 导出tablestore里面的数据到本地json
首先安装NodeJS
https://nodejs.org/en/download
直接下载msi，安装成功

打开Windows PowerShell 而不是cmd

```
node -v
npm -v

mkdir table_export
```
建立set_env.ps1 # 最开始是access key名字和密码
```
$env:ALIBABA_CLOUD_ACCESS_KEY_ID=""
$env:ALIBABA_CLOUD_ACCESS_KEY_SECRET=""
$env:OTS_ENDPOINT="https://license-gene.cn-hangzhou.ots.aliyuncs.com"
$env:OTS_INSTANCE="license-gene"

Write-Host " ENV READY"
```
```
.\set_env.ps1
```
若无法执行脚本
```
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```
```
node export_all_tablestore_tables.js
```
