import { apiKeyService } from "../services/ApiKeyService";
import { prisma } from "../lib/prisma";

// 简单测试（需在本地 dev DB 下运行）
(async () => {
  const key = await apiKeyService.getSystemApiKey();
  const ok = await apiKeyService.validateApiKey(key);
  if (!ok) {
    console.error("API key validation failed for current key");
    process.exit(1);
  }
  const newKey = await apiKeyService.regenerateSystemApiKey();
  if (newKey === key) {
    console.error("API key regeneration did not change the key");
    process.exit(2);
  }
  const oldStillValid = await apiKeyService.validateApiKey(key);
  if (!oldStillValid) {
    console.error("Previous key should be valid during grace period");
    process.exit(3);
  }
  console.log("API key rotation test passed");
  await prisma.$disconnect();
})();
