import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

export interface EmailConfig {
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  to: string[];
  subject: string;
}

export interface AlertLevel {
  level: 'info' | 'warning' | 'critical';
  title: string;
  message: string;
  details?: any;
  timestamp: Date;
}

const defaultConfig: EmailConfig = {
  enabled: (process.env.EMAIL_ALERTS_ENABLED || 'false').toLowerCase() === 'true',
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: (process.env.SMTP_SECURE || 'false').toLowerCase() === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },
  from: process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@ssalgten.com',
  to: (process.env.SMTP_TO || '').split(',').filter(e => e),
  subject: process.env.SMTP_SUBJECT || '[SsalgTen] Security Alert',
};

/**
 * 创建邮件传输器
 */
function createTransporter(config: EmailConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.auth.user,
      pass: config.auth.pass,
    },
  });
}

/**
 * 生成HTML邮件内容
 */
function generateEmailHtml(alert: AlertLevel, nodeName: string): string {
  const levelColors = {
    info: '#3b82f6',      // 蓝色
    warning: '#f59e0b',   // 橙色
    critical: '#ef4444',  // 红色
  };

  const levelIcons = {
    info: 'ℹ️',
    warning: '⚠️',
    critical: '🚨',
  };

  const color = levelColors[alert.level];
  const icon = levelIcons[alert.level];

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, ${color} 0%, ${color}dd 100%);
      color: white;
      padding: 30px;
      border-radius: 8px 8px 0 0;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .header .icon {
      font-size: 48px;
      margin-bottom: 10px;
    }
    .content {
      background: #f8f9fa;
      padding: 30px;
      border-radius: 0 0 8px 8px;
    }
    .info-box {
      background: white;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 20px;
      border-left: 4px solid ${color};
    }
    .info-row {
      display: flex;
      margin-bottom: 10px;
    }
    .info-label {
      font-weight: 600;
      min-width: 120px;
      color: #666;
    }
    .info-value {
      color: #333;
    }
    .details {
      background: #fff;
      padding: 15px;
      border-radius: 6px;
      font-family: 'Courier New', monospace;
      font-size: 13px;
      overflow-x: auto;
      border: 1px solid #e5e7eb;
    }
    .footer {
      text-align: center;
      padding: 20px;
      color: #666;
      font-size: 12px;
    }
    .footer a {
      color: ${color};
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="icon">${icon}</div>
    <h1>${alert.title}</h1>
  </div>
  
  <div class="content">
    <div class="info-box">
      <div class="info-row">
        <div class="info-label">Alert Level:</div>
        <div class="info-value" style="color: ${color}; font-weight: 600; text-transform: uppercase;">
          ${alert.level}
        </div>
      </div>
      <div class="info-row">
        <div class="info-label">Node:</div>
        <div class="info-value">${nodeName}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Time:</div>
        <div class="info-value">${alert.timestamp.toISOString()}</div>
      </div>
      <div class="info-row">
        <div class="info-label">Message:</div>
        <div class="info-value">${alert.message}</div>
      </div>
    </div>

    ${alert.details ? `
      <h3 style="margin-top: 20px; margin-bottom: 10px; color: #666;">Details:</h3>
      <div class="details">
        <pre>${JSON.stringify(alert.details, null, 2)}</pre>
      </div>
    ` : ''}
  </div>

  <div class="footer">
    <p>This is an automated alert from SsalgTen Security Monitoring System</p>
    <p>
      <a href="${process.env.MASTER_URL || 'http://localhost:3001'}">
        Open Dashboard
      </a>
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * 邮件告警服务
 */
export const emailAlertService = {
  config: defaultConfig,
  transporter: null as ReturnType<typeof createTransporter> | null,

  /**
   * 初始化邮件服务
   */
  initialize(): void {
    if (!this.config.enabled) {
      logger.info('Email alerts disabled');
      return;
    }

    if (!this.config.auth.user || !this.config.auth.pass) {
      logger.warn('Email alerts enabled but SMTP credentials not configured');
      return;
    }

    if (this.config.to.length === 0) {
      logger.warn('Email alerts enabled but no recipients configured');
      return;
    }

    try {
      this.transporter = createTransporter(this.config);
      logger.info(`Email alerts initialized: ${this.config.to.join(', ')}`);
    } catch (error) {
      logger.error('Failed to initialize email transporter:', error);
    }
  },

  /**
   * 发送告警邮件
   */
  async sendAlert(alert: AlertLevel, nodeName: string): Promise<boolean> {
    if (!this.config.enabled || !this.transporter) {
      return false;
    }

    try {
      const html = generateEmailHtml(alert, nodeName);

      const mailOptions = {
        from: this.config.from,
        to: this.config.to.join(','),
        subject: `${this.config.subject} - ${alert.level.toUpperCase()}: ${alert.title}`,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Alert email sent: ${info.messageId}`);
      return true;
    } catch (error) {
      logger.error('Failed to send alert email:', error);
      return false;
    }
  },

  /**
   * 测试邮件配置
   */
  async testConnection(): Promise<boolean> {
    if (!this.config.enabled || !this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      logger.error('SMTP connection test failed:', error);
      return false;
    }
  },

  /**
   * 获取当前配置（隐藏密码）
   */
  getConfig(): Partial<EmailConfig> {
    return {
      enabled: this.config.enabled,
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      from: this.config.from,
      to: this.config.to,
      auth: {
        user: this.config.auth.user,
        pass: '***', // 隐藏密码
      },
    };
  },

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<EmailConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // 重新初始化传输器
    if (this.config.enabled) {
      this.transporter = createTransporter(this.config);
    }
    
    logger.info('Email alert config updated');
  },
};
