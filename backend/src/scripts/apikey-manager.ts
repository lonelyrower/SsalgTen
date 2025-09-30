#!/usr/bin/env node

/**
 * API密钥管理工具
 * 用于生成、查看、重置系统API密钥
 */

import { apiKeyService } from "../services/ApiKeyService";
import { logger } from "../utils/logger";

async function main() {
  const command = process.argv[2];

  try {
    switch (command) {
      case "show":
        await showApiKey();
        break;
      case "generate":
        await generateNewApiKey();
        break;
      case "check":
        await checkApiKeySecurity();
        break;
      case "info":
        await showApiKeyInfo();
        break;
      default:
        showHelp();
    }
  } catch (error) {
    logger.error("API密钥管理工具执行失败:", error);
    process.exit(1);
  }

  process.exit(0);
}

async function showApiKey() {
  console.log("🔑 当前系统API密钥:");
  const apiKey = await apiKeyService.getSystemApiKey();
  console.log(`   完整密钥: ${apiKey}`);
  console.log(`   前缀: ${apiKey.substring(0, 10)}...`);
  console.log("");
  console.log("💡 提示: 请将此密钥配置到Agent的环境变量 AGENT_API_KEY 中");
}

async function generateNewApiKey() {
  console.log("🔄 正在生成新的API密钥...");
  const newKey = await apiKeyService.regenerateSystemApiKey();
  console.log("");
  console.log("✅ 新的API密钥已生成:");
  console.log(`   新密钥: ${newKey}`);
  console.log(`   前缀: ${newKey.substring(0, 10)}...`);
  console.log("");
  console.log("⚠️ 注意事项:");
  console.log("   - 旧密钥在24小时内仍然有效（宽限期）");
  console.log("   - 请尽快更新所有Agent的API密钥配置");
  console.log("   - 建议重启Agent服务以使新密钥生效");
}

async function checkApiKeySecurity() {
  console.log("🔒 检查API密钥安全性...");
  const check = await apiKeyService.checkApiKeySecurity();
  console.log("");

  if (check.isSecure) {
    console.log("✅ API密钥安全检查通过");
  } else {
    console.log("⚠️ API密钥安全检查发现问题:");
    check.warnings.forEach((warning) => {
      console.log(`   ❌ ${warning}`);
    });

    console.log("");
    console.log("💡 建议操作:");
    check.recommendations.forEach((rec) => {
      console.log(`   📋 ${rec}`);
    });
  }
}

async function showApiKeyInfo() {
  console.log("📊 API密钥详细信息:");
  const info = await apiKeyService.getApiKeyInfo();
  console.log("");
  console.log(`   密钥ID: ${info.id}`);
  console.log(`   密钥: ${info.key.substring(0, 10)}...`);
  console.log(`   描述: ${info.description}`);
  console.log(`   是否默认: ${info.isDefault ? "是" : "否"}`);
  console.log(`   创建时间: ${info.createdAt.toISOString()}`);
  console.log(`   使用次数: ${info.usageCount}`);
  console.log(
    `   最后使用: ${info.lastUsed ? info.lastUsed.toISOString() : "从未使用"}`,
  );

  // 显示旧密钥宽限期信息
  if (info.hasPreviousKey) {
    console.log(`   旧密钥宽限期至: ${info.previousKeyGraceUntil}`);
  }
}

function showHelp() {
  console.log("🔑 SsalgTen API密钥管理工具");
  console.log("");
  console.log("使用方法:");
  console.log("  npm run apikey <命令>");
  console.log("");
  console.log("可用命令:");
  console.log("  show      - 显示当前API密钥");
  console.log("  generate  - 生成新的API密钥");
  console.log("  check     - 检查API密钥安全性");
  console.log("  info      - 显示API密钥详细信息");
  console.log("");
  console.log("示例:");
  console.log("  npm run apikey show");
  console.log("  npm run apikey generate");
  console.log("  npm run apikey check");
}

// 只有直接运行时才执行
if (require.main === module) {
  main();
}
