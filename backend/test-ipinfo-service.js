// 测试IPInfoService
require('dotenv').config();

// Mock logger
const logger = {
  info: console.log,
  error: console.error,
  warn: console.warn
};

// Mock完整的IPInfoService
class TestIPInfoService {
  constructor() {
    this.ipinfoToken = process.env.IPINFO_TOKEN || '';
    this.cache = new Map();
    this.CACHE_TTL = 24 * 60 * 60 * 1000;
  }

  async getIPInfo(ip) {
    try {
      console.log(`🔍 查询IP: ${ip}`);
      
      const axios = require('axios');
      
      // 构建请求URL
      const baseUrl = 'https://ipinfo.io';
      const url = this.ipinfoToken 
        ? `${baseUrl}/${ip}?token=${this.ipinfoToken}`
        : `${baseUrl}/${ip}`;

      console.log(`📡 请求URL: ${url}`);
      
      const response = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'SsalgTen-NetworkMonitor/1.0'
        }
      });

      const data = response.data;
      console.log(`📊 原始数据:`, JSON.stringify(data, null, 2));
      
      // 解析ASN信息从org字段
      let asnInfo = {
        asn: 'Unknown',
        name: 'Unknown', 
        org: data.org || 'Unknown',
        route: 'N/A',
        type: 'N/A'
      };

      if (data.org) {
        const orgMatch = data.org.match(/^AS(\d+)\s+(.+)$/);
        if (orgMatch) {
          asnInfo.asn = `AS${orgMatch[1]}`;
          asnInfo.name = orgMatch[2].trim();
          
          // 根据ASN名称推断类型
          const name = asnInfo.name.toLowerCase();
          if (name.includes('google') || name.includes('amazon') || name.includes('microsoft') || 
              name.includes('facebook') || name.includes('cloudflare') || name.includes('apple')) {
            asnInfo.type = 'Content/CDN';
          } else if (name.includes('telecom') || name.includes('mobile') || name.includes('wireless') ||
                     name.includes('cellular') || name.includes('lte') || name.includes('5g')) {
            asnInfo.type = 'Mobile/ISP';
          } else if (name.includes('hosting') || name.includes('server') || name.includes('cloud') ||
                     name.includes('datacenter') || name.includes('digital ocean') || name.includes('linode')) {
            asnInfo.type = 'Hosting';
          } else if (name.includes('university') || name.includes('edu') || name.includes('research') ||
                     name.includes('academic') || name.includes('institute')) {
            asnInfo.type = 'Education';
          } else if (name.includes('government') || name.includes('gov') || name.includes('military') ||
                     name.includes('defense')) {
            asnInfo.type = 'Government';
          } else if (name.includes('isp') || name.includes('internet') || name.includes('broadband') ||
                     name.includes('fiber') || name.includes('cable')) {
            asnInfo.type = 'ISP';
          } else if (name.includes('exchange') || name.includes('ix') || name.includes('peering')) {
            asnInfo.type = 'IX/Peering';
          } else {
            asnInfo.type = 'Commercial';
          }
          
          asnInfo.route = 'Check BGP tables';
          console.log(`✅ ASN解析成功: ${asnInfo.asn} - ${asnInfo.name} (${asnInfo.type})`);
        } else {
          asnInfo.name = data.org;
          asnInfo.type = 'Unknown';
          console.log(`⚠️ ASN格式异常，使用org作为name: ${asnInfo.name}`);
        }
      } else {
        console.log(`❌ 没有org信息`);
      }

      const ipInfo = {
        ip: data.ip,
        hostname: data.hostname,
        city: data.city || 'Unknown',
        region: data.region || 'Unknown', 
        country: data.country || 'Unknown',
        loc: data.loc || '0,0',
        postal: data.postal,
        timezone: data.timezone || 'UTC',
        asn: asnInfo,
        company: data.company ? {
          name: data.company.name || 'Unknown',
          domain: data.company.domain,
          type: data.company.type
        } : undefined
      };

      console.log(`🎯 最终ASN信息:`);
      console.log(`   ASN: ${ipInfo.asn.asn}`);
      console.log(`   Name: ${ipInfo.asn.name}`);
      console.log(`   Org: ${ipInfo.asn.org}`);
      console.log(`   Route: ${ipInfo.asn.route}`);
      console.log(`   Type: ${ipInfo.asn.type}`);
      
      return ipInfo;

    } catch (error) {
      console.error('❌ 获取IP信息失败:', { ip, error: error?.message });
      
      return {
        ip,
        city: 'Unknown',
        region: 'Unknown',
        country: 'Unknown',
        loc: '0,0',
        timezone: 'UTC',
        asn: {
          asn: 'Unknown',
          name: 'Unknown',
          org: 'Unknown',
          route: 'Unknown',
          type: 'Unknown'
        }
      };
    }
  }
}

async function test() {
  console.log('🚀 开始测试IPInfoService...\n');
  
  const service = new TestIPInfoService();
  
  const testIPs = ['8.8.8.8', '1.1.1.1', '114.114.114.114'];
  
  for (const ip of testIPs) {
    console.log(`\n${'='.repeat(50)}`);
    const result = await service.getIPInfo(ip);
    console.log(`${'='.repeat(50)}\n`);
    
    // 等待1秒避免API限制
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('✅ 测试完成');
}

test().catch(console.error);