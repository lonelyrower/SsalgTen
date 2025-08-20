#!/usr/bin/env tsx

/**
 * ASN信息更新脚本
 * 用于为现有节点批量更新ASN信息
 * 
 * 运行方式：
 * npm run db:update-asn
 * 或
 * npx tsx src/scripts/update-asn.ts
 */

import { nodeService } from '../services/NodeService';
import { logger } from '../utils/logger';

async function main() {
  try {
    logger.info('开始更新节点ASN信息...');
    
    // 批量更新所有缺失ASN信息的节点
    await nodeService.updateNodesASN();
    
    logger.info('ASN信息更新完成！');
    process.exit(0);
  } catch (error) {
    logger.error('ASN信息更新失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此脚本
if (require.main === module) {
  main();
}

export default main;