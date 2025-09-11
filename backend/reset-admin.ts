import { forceResetAdminPassword } from './src/utils/seed';
import { logger } from './src/utils/logger';

async function main() {
  try {
    logger.info('🚀 Starting admin password reset...');
    await forceResetAdminPassword();
    logger.info('🎉 Admin password reset completed successfully!');
    logger.info('');
    logger.info('🔑 You can now login with:');
    logger.info('   Username: admin');
    logger.info('   Password: admin123');
    logger.info('');
    logger.info('⚠️  Please change the password after first login for security!');
    process.exit(0);
  } catch (error) {
    logger.error('💥 Admin password reset failed:', error);
    process.exit(1);
  }
}

main();