'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const RPCClient = require('@alicloud/pop-core');
const app = express();

// 增大 body limit 以支持图片上传
app.use(bodyParser.json({ limit: '10mb' }));

// 1. 阿里云配置
const config = {
  dashscopeApiKey: process.env.DASHSCOPE_API_KEY,
  accessKeyId: process.env.ALICLOUD_ACCESS_KEY_ID,
  accessKeySecret: process.env.ALICLOUD_ACCESS_KEY_SECRET,
  tableDataAccessKeyId: process.env.ALICLOUD_ACCESS_KEY_ID_2,
  tableDataSecretAccessKey: process.env.ALICLOUD_ACCESS_KEY_SECRET_2,
  appKey: 'VOU23wE6aT2bExjQ', 
  endpoint: 'http://nls-meta.cn-shanghai.aliyuncs.com',
  apiVersion: '2019-02-28'
};

// 缓存 Token
let cachedToken = { value: '', expireTime: 0 };

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken.value && cachedToken.expireTime > now + 600) {
    return cachedToken.value;
  }
  const client = new RPCClient({
    accessKeyId: config.accessKeyId,
    accessKeySecret: config.accessKeySecret,
    endpoint: config.endpoint,
    apiVersion: config.apiVersion
  });
  const result = await client.request('CreateToken', {}, { method: 'POST' });
  cachedToken = {
    value: result.Token.Id,
    expireTime: result.Token.ExpireTime
  };
  return cachedToken.value;
}

// --- 1. 抽离公共的 TTS 请求逻辑 ---
async function generateTTSAudio(text, voice = 'Zhiqi') {
  const token = await getAccessToken();
  const url = 'https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/tts';
  
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appkey: config.appKey,
      token: token,
      text: text,
      format: 'mp3',
      sample_rate: 16000,
      voice: voice
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("TTS API Error:", errText);
    throw new Error("TTS Failed");
  }

  // 检查是否返回了 JSON 错误信息
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const err = await response.json();
    throw new Error(JSON.stringify(err));
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// 跨域处理
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

// --- ASR 接口  ---
app.post('/asr', async (req, res) => {
  try {
    const { audioData, format = 'wav', sample_rate = 16000 } = req.body;
    if (!audioData) return res.status(400).json({ error: "音频数据为空" });

    const audioBuffer = Buffer.from(audioData, 'base64');
    const token = await getAccessToken();
    const url = `https://nls-gateway-cn-shanghai.aliyuncs.com/stream/v1/asr?appkey=${config.appKey}&format=${format}&sample_rate=${sample_rate}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-NLS-Token': token,
        'Content-Type': 'application/octet-stream',
        'Content-Length': audioBuffer.length.toString()
      },
      body: audioBuffer
    });

    const result = await response.json();
    console.log("✅ ASR Result:", JSON.stringify(result));
    res.json({ text: result.result || "", status: result.status, message: result.message });
  } catch (e) {
    console.error("❌ ASR Error:", e);
    res.status(500).json({ error: e.message });
  }
});

// --- QWEN 接口 (支持 auto_tts 和流式返回) ---
app.post('/qwen', async (req, res) => {
  try {
    // 新增 auto_tts 参数，默认 false
    const { messages, image, auto_tts = false } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ reply: "参数错误: messages 必须是数组" });
    }

    let processedMessages = JSON.parse(JSON.stringify(messages));
    let lastMessage = processedMessages[processedMessages.length - 1];

    if (image) {
      const textContent = lastMessage.content;
      lastMessage.content = [
        { image: `data:image/jpeg;base64,${image}` },
        { text: textContent }
      ];
    } 

    console.log("🚀 Sending to DashScope..."); 

    const modelName = image ? "qwen-vl-plus" : "qwen-turbo"; 

    const qwenResponse = await fetch('https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.dashscopeApiKey}`,
        'Content-Type': 'application/json',
        'X-DashScope-SSE': 'disable' 
      },
      body: JSON.stringify({
        model: "qwen-vl-plus", 
        input: { messages: processedMessages },
        parameters: { result_format: "message" }
      })
    });

    const data = await qwenResponse.json();
    
    if (data.code) {
      return res.status(500).json({ reply: `AI 思考失败: ${data.message}` });
    }

    let replyText = "";
    const content = data.output.choices[0].message.content;

    if (Array.isArray(content)) {
      const textItem = content.find(item => item.text);
      replyText = textItem ? textItem.text : "我没能生成回答。";
    } else {
      replyText = content; 
    }
    if (!replyText && typeof content === 'string') {
        replyText = content;
    }

    console.log("🤖 Qwen Reply length:", replyText.length);

    // ================= 核心修改逻辑开始 =================
    if (auto_tts) {
      // 开启 SSE (Server-Sent Events) 流式响应
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      // 1. 立即推回文字让客户端渲染
      const textPayload = JSON.stringify({ type: 'text', content: replyText });
      res.write(`data: ${textPayload}\n\n`);

      // 2. 触发 TTS 请求 (服务端进行，不阻塞客户端读文字)
      try {
        const audioBuffer = await generateTTSAudio(replyText);
        // 将音频转为 Base64 字符串发送
        const base64Audio = audioBuffer.toString('base64');
        const audioPayload = JSON.stringify({ type: 'audio', content: base64Audio });
        res.write(`data: ${audioPayload}\n\n`);
      } catch (ttsError) {
        console.error("❌ Auto TTS Error:", ttsError);
        const errorPayload = JSON.stringify({ type: 'error', content: 'TTS Generation Failed' });
        res.write(`data: ${errorPayload}\n\n`);
      }

      // 3. 所有任务完成，结束连接
      res.end();

    } else {
      // 如果不需要 auto_tts，保持原有的普通 JSON 响应，兼容旧逻辑
      res.json({
        reply: replyText,
        status: 200
      });
    }
    // ================= 核心修改逻辑结束 =================

  } catch (error) {
    console.error("❌ Qwen Proxy Error:", error);
    if (!res.headersSent) {
        res.status(500).json({ reply: `服务器代理异常: ${error.message}` });
    } else {
        res.end(); // 如果是在流输出中途报错，直接关闭流
    }
  }
});

// --- TTS 接口 ---
app.post('/tts', async (req, res) => {
  try {
    const { text, voice = 'Zhiqi' } = req.body;
    if (!text) return res.status(400).json({ error: "No text provided" });

    const buffer = await generateTTSAudio(text, voice);
    
    res.set('Content-Type', 'audio/mpeg');
    res.send(buffer);

  } catch (error) {
    console.error("❌ Standard TTS Proxy Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 初始化 Tablestore 客户端
const TableStore = require('tablestore');
const client = new TableStore.Client({
  accessKeyId: config.tableDataAccessKeyId,
  secretAccessKey: config.tableDataSecretAccessKey,
  endpoint: 'https://YourTeacher.cn-hangzhou.vpc.tablestore.aliyuncs.com',
  instancename: 'YourTeacher',  // 替换为你的 Tablestore 实例名
  timeout: 30000,  // 可选
});
// ── 上传聊天记录接口 ──
app.post('/upload-chat', async (req, res) => {
  console.log('收到 /upload-chat POST 请求');
  console.log('请求头:', req.headers);
  console.log('请求体大小:', req.body ? req.body.length : 0, 'bytes');

  try {
    // 确保 body 已解析（因为用了 express.json() 中间件）
    const body = req.body;

    // 打印部分 body 用于调试（避免日志过长）
    console.log('请求体预览:', JSON.stringify(body, null, 2).substring(0, 800));

    const { user_id, session_id, device_time, messages } = body;

    // 必填字段校验
    if (!user_id || !session_id || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: '缺少必要字段：user_id, session_id, messages（必须是数组且非空）'
      });
    }

    // 生成主键（时间戳 + session_id 避免冲突）
    const timestampStr = device_time || new Date().toISOString();
    const sessionTimestamp = `${session_id}_${timestampStr}`;

    const primaryKey = [
      { user_id: user_id },              // 第一主键（分区键）
      { session_timestamp: sessionTimestamp }  // 第二主键（排序键）
    ];

    // 属性列
    const attributeColumns = [
      { messages: JSON.stringify(messages) },     // 完整消息数组转字符串
      { device_time: timestampStr },
      { message_count: messages.length },
      // 可选：你可以根据 Flutter payload 添加更多字段
      // { subject_id: body.subject_id || '' },
      // { focus_minutes: body.focus_minutes || 0 },
      // { image_urls: JSON.stringify(body.image_urls || []) },
    ];

    // 条件：IGNORE（如果行已存在则不覆盖，保持幂等）
    const condition = new TableStore.Condition(
      TableStore.RowExistenceExpectation.IGNORE,
      null  // 无额外列条件
    );

    const params = {
      tableName: 'study_chat_history',   // 必须与你创建的表名一致！
      condition: condition,
      primaryKey: primaryKey,
      attributeColumns: attributeColumns,
    };

    console.log('准备写入 Tablestore，表名:', params.tableName);

    // 执行写入
    const putResult = await new Promise((resolve, reject) => {
      client.putRow(params, (err, data) => {
        if (err) {
          console.error('Tablestore putRow 错误:', err);
          reject(err);
        } else {
          resolve(data);
        }
      });
    });

    console.log('写入成功，消耗写 CU:', putResult.consumed?.write || 0);

    res.status(200).json({
      success: true,
      message: '聊天记录已保存到 Tablestore',
      rowKey: sessionTimestamp,
      consumedWriteCU: putResult.consumed?.write || 0,
    });

  } catch (error) {
    console.error('❌ /upload-chat 处理异常:', error);

    let status = 500;
    let errorMsg = '服务器内部错误';

    if (error.code) {
      // Tablestore 常见错误码处理
      if (error.code === 'OTSParameterInvalid') {
        status = 400;
        errorMsg = `参数无效：${error.message || '检查主键、表名、condition 是否正确'}`;
      } else if (error.code === 'OTSAuthFailed' || error.code === 'AccessDenied') {
        status = 403;
        errorMsg = '权限不足：请检查 FC 执行角色是否授予 AliyunTableStoreFullAccess';
      } else if (error.code === 'OTSObjectNotExist') {
        status = 404;
        errorMsg = '表不存在：请确认表名 study_chat_history 已创建';
      } else if (error.code === 'OTSRowOperationConflict') {
        status = 409;
        errorMsg = '行冲突：可能主键重复或条件不满足';
      }
    }

    res.status(status).json({
      success: false,
      error: errorMsg,
      details: error.message || '未知错误',
      code: error.code || 'unknown'
    });
  }
});

// -- 服务器启动 ---
app.listen(9000, () => {
    console.log('Server started on port 9000');
});