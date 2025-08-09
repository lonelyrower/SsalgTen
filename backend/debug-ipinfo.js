// 调试IPInfo API返回的数据格式
require('dotenv').config();

const axios = require('axios');

async function debugIPInfo() {
  try {
    console.log('🔍 调试IPInfo API...');
    
    const ip = '8.8.8.8';
    const url = `https://ipinfo.io/${ip}`;
    
    const response = await axios.get(url, { timeout: 10000 });
    
    console.log('📡 完整响应数据:');
    console.log(JSON.stringify(response.data, null, 2));
    
    console.log('\n🏷️ 重要字段解析:');
    console.log('IP:', response.data.ip);
    console.log('城市:', response.data.city);
    console.log('国家:', response.data.country);  
    console.log('组织:', response.data.org);
    console.log('ASN字段:', response.data.asn);
    console.log('位置:', response.data.loc);
    
  } catch (error) {
    console.error('❌ 调试失败:', error.message);
  }
}

debugIPInfo();