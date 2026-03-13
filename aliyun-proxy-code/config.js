'use strict';

// 通过环境变量控制 DEBUG 模式，默认关闭
const isDebug = process.env.DEBUG === 'true';

module.exports = {
  DEBUG: isDebug,
  port: process.env.PORT || 9000,
  
  // 阿里云鉴权与服务配置
  dashscopeApiKey: process.env.DASHSCOPE_API_KEY,
  accessKeyId: process.env.ALICLOUD_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALICLOUD_ACCESS_KEY_SECRET,
  
  // Tablestore 配置
  tableDataAccessKeyId: process.env.ALICLOUD_ACCESS_KEY_ID_2,
  tableDataSecretAccessKey: process.env.ALICLOUD_ACCESS_KEY_SECRET_2,
  tablestoreEndpoint: 'https://YourTeacher.cn-hangzhou.vpc.tablestore.aliyuncs.com',
  tablestoreInstance: 'YourTeacher',
  
  // NLS (语音) 配置
  appKey: 'VOU23wE6aT2bExjQ', 
  nlsEndpoint: 'http://nls-meta.cn-shanghai.aliyuncs.com',
  apiVersion: '2019-02-28'
};