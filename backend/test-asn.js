// 测试ASN信息获取服务
require('dotenv').config();

const axios = require('axios');

async function testIPInfo() {
  try {
    console.log('🔍 测试IP信息获取服务...');
    
    // 测试几个知名IP
    const testIPs = [
      '8.8.8.8',        // Google DNS
      '1.1.1.1',        // Cloudflare DNS  
      '114.114.114.114', // 114 DNS
    ];
    
    for (const ip of testIPs) {
      console.log(`\n📍 测试IP: ${ip}`);
      
      const url = `https://ipinfo.io/${ip}`;
      const response = await axios.get(url, { timeout: 5000 });
      
      console.log(`  城市: ${response.data.city || 'Unknown'}`);
      console.log(`  国家: ${response.data.country || 'Unknown'}`);
      console.log(`  组织: ${response.data.org || 'Unknown'}`);
      console.log(`  位置: ${response.data.loc || 'Unknown'}`);
      
      // 模拟等待避免API限制
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('\n✅ IP信息服务测试完成');
  } catch (error) {
    console.error('❌ IP信息服务测试失败:', error.message);
  }
}

testIPInfo();