const { PrismaClient } = require('@prisma/client');

async function getApiKey() {
  const prisma = new PrismaClient({
    datasourceUrl: 'file:./dev.db'
  });
  
  try {
    const apiKeySetting = await prisma.setting.findUnique({
      where: {
        key: 'SYSTEM_AGENT_API_KEY'
      }
    });
    
    if (apiKeySetting) {
      console.log('Current API Key:', apiKeySetting.value);
    } else {
      console.log('No API key found in database');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

getApiKey();