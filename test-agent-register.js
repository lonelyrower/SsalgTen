#!/usr/bin/env node

// 测试Agent注册接口
const https = require('https');
const http = require('http');

// 测试数据
const testData = {
  agentId: 'test-agent-' + Date.now(),
  apiKey: 'default-agent-api-key-change-this-in-production',  // 使用正确的fallback密钥
  nodeInfo: {
    name: 'Test-Node-' + Date.now(),
    country: 'China',
    city: 'Beijing', 
    latitude: 39.9042,
    longitude: 116.4074,
    provider: 'Test Provider',
    ipv4: '192.168.1.100'
  },
  systemInfo: {
    platform: 'linux',
    version: 'Ubuntu 20.04'
  }
};

console.log('🧪 测试Agent注册接口');
console.log('AgentId:', testData.agentId);
console.log('API Key:', testData.apiKey.substring(0, 10) + '...');

const postData = JSON.stringify(testData);
const serverUrl = process.env.SERVER_URL || 'http://localhost:3002';
const url = new URL('/api/agents/register', serverUrl);

const options = {
  hostname: url.hostname,
  port: url.port || (url.protocol === 'https:' ? 443 : 80),
  path: url.pathname,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'X-API-Key': testData.apiKey
  }
};

const client = url.protocol === 'https:' ? https : http;

const req = client.request(options, (res) => {
  console.log('\n📡 响应状态:', res.statusCode);
  console.log('📡 响应头:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\n📝 响应内容:');
    try {
      const response = JSON.parse(data);
      console.log(JSON.stringify(response, null, 2));
    } catch (e) {
      console.log(data);
    }
    
    if (res.statusCode === 200) {
      console.log('\n✅ Agent注册成功!');
    } else {
      console.log('\n❌ Agent注册失败');
    }
  });
});

req.on('error', (error) => {
  console.error('\n💥 请求错误:', error.message);
});

// 发送请求
req.write(postData);
req.end();