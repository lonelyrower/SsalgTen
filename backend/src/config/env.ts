import "dotenv/config";

// Environment Variables Configuration
// This file provides unified configuration with defaults and validation

export interface EnvConfig {
  // Server Configuration
  NODE_ENV: string;
  PORT: number;
  HOST: string;

  // Database Configuration
  DATABASE_URL: string;
  POSTGRES_USER: string;
  POSTGRES_PASSWORD: string;
  POSTGRES_DB: string;
  POSTGRES_HOST: string;
  POSTGRES_PORT: number;

  // Redis Configuration
  REDIS_URL?: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  REDIS_PASSWORD?: string;

  // JWT Configuration
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  REFRESH_TOKEN_EXPIRES_IN: string;

  // API Configuration
  API_KEY_SECRET: string;
  DEFAULT_AGENT_API_KEY: string;

  // CORS Configuration
  CORS_ORIGIN: string;

  // Agent Configuration
  AGENT_HEARTBEAT_INTERVAL: number;
  AGENT_TIMEOUT: number;
  AGENT_OFFLINE_THRESHOLD: number;
  AGENT_REQUIRE_SIGNATURE: boolean;
  AGENT_CONTROL_PROTOCOL: string;
  AGENT_CONTROL_PORT: number;
  AGENT_CONTROL_TIMEOUT: number;
  AGENT_CONTROL_API_KEY: string;

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;

  // Logging Configuration
  LOG_LEVEL: string;
  ENABLE_MORGAN: boolean;

  // Network Diagnostic Defaults
  DEFAULT_PING_COUNT: number;
  DEFAULT_TRACEROUTE_MAX_HOPS: number;
  MTR_COUNT: number;
  SPEEDTEST_SERVER_ID: string;

  // System Configuration
  TRUST_PROXY: boolean;
  ENABLE_SYSTEM_METRICS: boolean;
  HEALTH_CHECK_INTERVAL: number;

  // WebSocket Configuration
  SOCKET_PING_TIMEOUT: number;
  SOCKET_PING_INTERVAL: number;

  // Cache Configuration
  CACHE_TTL: number;
}

// Default configuration values
const defaultConfig: Partial<EnvConfig> = {
  NODE_ENV: "development",
  PORT: 3001,
  HOST: "0.0.0.0",

  POSTGRES_HOST: "localhost",
  POSTGRES_PORT: 5432,
  POSTGRES_USER: "ssalgten",
  POSTGRES_PASSWORD: "ssalgten_password",
  POSTGRES_DB: "ssalgten",

  REDIS_HOST: "localhost",
  REDIS_PORT: 6379,

  JWT_EXPIRES_IN: "10m",
  REFRESH_TOKEN_EXPIRES_IN: "7d",

  CORS_ORIGIN: "http://localhost:3000",
  DEFAULT_AGENT_API_KEY: "",

  AGENT_HEARTBEAT_INTERVAL: 30000, // 30 seconds
  AGENT_TIMEOUT: 10000, // 10 seconds
  AGENT_OFFLINE_THRESHOLD: 90000, // 90 seconds (3 missed heartbeats)
  AGENT_REQUIRE_SIGNATURE: false,
  AGENT_CONTROL_PROTOCOL: "http",
  AGENT_CONTROL_PORT: 3002,
  AGENT_CONTROL_TIMEOUT: 8000,

  RATE_LIMIT_WINDOW_MS: 900000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 100,

  LOG_LEVEL: "info",
  ENABLE_MORGAN: false,

  DEFAULT_PING_COUNT: 4,
  DEFAULT_TRACEROUTE_MAX_HOPS: 30,
  MTR_COUNT: 10,
  SPEEDTEST_SERVER_ID: "auto",

  TRUST_PROXY: true,
  ENABLE_SYSTEM_METRICS: false,
  HEALTH_CHECK_INTERVAL: 30000, // 30 seconds

  SOCKET_PING_TIMEOUT: 60000, // 60 seconds
  SOCKET_PING_INTERVAL: 25000, // 25 seconds

  CACHE_TTL: 300000, // 5 minutes
};

// Environment variable parsing utilities
const parseBoolean = (
  value: string | undefined,
  defaultValue: boolean,
): boolean => {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
};

const parseNumber = (
  value: string | undefined,
  defaultValue: number,
): number => {
  if (value === undefined) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
};

const parseString = (
  value: string | undefined,
  defaultValue: string,
): string => {
  return value !== undefined ? value : defaultValue;
};

// Load and validate environment configuration
export const loadEnvConfig = (): EnvConfig => {
  const config: EnvConfig = {
    NODE_ENV: parseString(process.env.NODE_ENV, defaultConfig.NODE_ENV!),
    PORT: parseNumber(process.env.PORT, defaultConfig.PORT!),
    HOST: parseString(process.env.HOST, defaultConfig.HOST!),

    DATABASE_URL: parseString(
      process.env.DATABASE_URL,
      `postgresql://${defaultConfig.POSTGRES_USER}:${defaultConfig.POSTGRES_PASSWORD}@${defaultConfig.POSTGRES_HOST}:${defaultConfig.POSTGRES_PORT}/${defaultConfig.POSTGRES_DB}`,
    ),
    POSTGRES_USER: parseString(
      process.env.POSTGRES_USER,
      defaultConfig.POSTGRES_USER!,
    ),
    POSTGRES_PASSWORD: parseString(
      process.env.POSTGRES_PASSWORD,
      defaultConfig.POSTGRES_PASSWORD!,
    ),
    POSTGRES_DB: parseString(
      process.env.POSTGRES_DB,
      defaultConfig.POSTGRES_DB!,
    ),
    POSTGRES_HOST: parseString(
      process.env.POSTGRES_HOST,
      defaultConfig.POSTGRES_HOST!,
    ),
    POSTGRES_PORT: parseNumber(
      process.env.POSTGRES_PORT,
      defaultConfig.POSTGRES_PORT!,
    ),

    REDIS_URL: process.env.REDIS_URL,
    REDIS_HOST: parseString(process.env.REDIS_HOST, defaultConfig.REDIS_HOST!),
    REDIS_PORT: parseNumber(process.env.REDIS_PORT, defaultConfig.REDIS_PORT!),
    REDIS_PASSWORD: process.env.REDIS_PASSWORD,

    JWT_SECRET: parseString(process.env.JWT_SECRET, ""),
    JWT_EXPIRES_IN: parseString(
      process.env.JWT_EXPIRES_IN,
      defaultConfig.JWT_EXPIRES_IN!,
    ),
    REFRESH_TOKEN_EXPIRES_IN: parseString(
      process.env.REFRESH_TOKEN_EXPIRES_IN,
      defaultConfig.REFRESH_TOKEN_EXPIRES_IN!,
    ),

    API_KEY_SECRET: parseString(process.env.API_KEY_SECRET, ""),
    DEFAULT_AGENT_API_KEY: parseString(process.env.DEFAULT_AGENT_API_KEY, ""),

    CORS_ORIGIN: parseString(
      process.env.CORS_ORIGIN,
      defaultConfig.CORS_ORIGIN!,
    ),

    AGENT_HEARTBEAT_INTERVAL: parseNumber(
      process.env.AGENT_HEARTBEAT_INTERVAL,
      defaultConfig.AGENT_HEARTBEAT_INTERVAL!,
    ),
    AGENT_TIMEOUT: parseNumber(
      process.env.AGENT_TIMEOUT,
      defaultConfig.AGENT_TIMEOUT!,
    ),
    AGENT_OFFLINE_THRESHOLD: parseNumber(
      process.env.AGENT_OFFLINE_THRESHOLD,
      defaultConfig.AGENT_OFFLINE_THRESHOLD!,
    ),
    AGENT_REQUIRE_SIGNATURE: parseBoolean(
      process.env.AGENT_REQUIRE_SIGNATURE,
      defaultConfig.AGENT_REQUIRE_SIGNATURE!,
    ),
    AGENT_CONTROL_PROTOCOL: parseString(
      process.env.AGENT_CONTROL_PROTOCOL,
      defaultConfig.AGENT_CONTROL_PROTOCOL!,
    ),
    AGENT_CONTROL_PORT: parseNumber(
      process.env.AGENT_CONTROL_PORT,
      defaultConfig.AGENT_CONTROL_PORT!,
    ),
    AGENT_CONTROL_TIMEOUT: parseNumber(
      process.env.AGENT_CONTROL_TIMEOUT,
      defaultConfig.AGENT_CONTROL_TIMEOUT!,
    ),
    AGENT_CONTROL_API_KEY: parseString(
      process.env.AGENT_CONTROL_API_KEY,
      process.env.DEFAULT_AGENT_API_KEY ||
        defaultConfig.DEFAULT_AGENT_API_KEY! ||
        "",
    ),

    RATE_LIMIT_WINDOW_MS: parseNumber(
      process.env.RATE_LIMIT_WINDOW_MS,
      defaultConfig.RATE_LIMIT_WINDOW_MS!,
    ),
    RATE_LIMIT_MAX_REQUESTS: parseNumber(
      process.env.RATE_LIMIT_MAX_REQUESTS,
      defaultConfig.RATE_LIMIT_MAX_REQUESTS!,
    ),

    LOG_LEVEL: parseString(process.env.LOG_LEVEL, defaultConfig.LOG_LEVEL!),
    ENABLE_MORGAN: parseBoolean(
      process.env.ENABLE_MORGAN,
      defaultConfig.ENABLE_MORGAN!,
    ),

    DEFAULT_PING_COUNT: parseNumber(
      process.env.DEFAULT_PING_COUNT,
      defaultConfig.DEFAULT_PING_COUNT!,
    ),
    DEFAULT_TRACEROUTE_MAX_HOPS: parseNumber(
      process.env.DEFAULT_TRACEROUTE_MAX_HOPS,
      defaultConfig.DEFAULT_TRACEROUTE_MAX_HOPS!,
    ),
    MTR_COUNT: parseNumber(process.env.MTR_COUNT, defaultConfig.MTR_COUNT!),
    SPEEDTEST_SERVER_ID: parseString(
      process.env.SPEEDTEST_SERVER_ID,
      defaultConfig.SPEEDTEST_SERVER_ID!,
    ),

    TRUST_PROXY: parseBoolean(
      process.env.TRUST_PROXY,
      defaultConfig.TRUST_PROXY!,
    ),
    ENABLE_SYSTEM_METRICS: parseBoolean(
      process.env.ENABLE_SYSTEM_METRICS,
      defaultConfig.ENABLE_SYSTEM_METRICS!,
    ),
    HEALTH_CHECK_INTERVAL: parseNumber(
      process.env.HEALTH_CHECK_INTERVAL,
      defaultConfig.HEALTH_CHECK_INTERVAL!,
    ),

    SOCKET_PING_TIMEOUT: parseNumber(
      process.env.SOCKET_PING_TIMEOUT,
      defaultConfig.SOCKET_PING_TIMEOUT!,
    ),
    SOCKET_PING_INTERVAL: parseNumber(
      process.env.SOCKET_PING_INTERVAL,
      defaultConfig.SOCKET_PING_INTERVAL!,
    ),

    CACHE_TTL: parseNumber(process.env.CACHE_TTL, defaultConfig.CACHE_TTL!),
  };

  // Validate required environment variables
  const requiredVars = ["JWT_SECRET", "API_KEY_SECRET"];
  const missingVars = requiredVars.filter(
    (varName) => !config[varName as keyof EnvConfig],
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missingVars.join(", ")}`,
    );
  }

  // Additional security validation in production
  if (config.NODE_ENV === "production") {
    // Validate JWT_SECRET strength
    if (config.JWT_SECRET.length < 32) {
      throw new Error(
        "JWT_SECRET must be at least 32 characters in production environment",
      );
    }

    // Check for weak/default secrets
    const weakSecrets = [
      "default-secret",
      "secret",
      "changeme",
      "test",
      "your-super-secret-jwt-key-change-this-in-production",
      "change_me_use_the_generated_keys_above_or_run_the_command",
    ];
    const looksPlaceholder = (value: string): boolean =>
      weakSecrets.includes(value.toLowerCase()) ||
      /change[-_ ]?me/i.test(value) ||
      /change-this/i.test(value) ||
      /your-super-secret/i.test(value) ||
      /use_the_generated_keys_above/i.test(value);

    if (looksPlaceholder(config.JWT_SECRET)) {
      throw new Error(
        "JWT_SECRET appears to be a weak/default value. Please use a strong random secret in production",
      );
    }

    if (
      looksPlaceholder(config.API_KEY_SECRET) ||
      /your-api-key-secret/i.test(config.API_KEY_SECRET)
    ) {
      throw new Error(
        "API_KEY_SECRET appears to be a weak/default value. Please use a strong random secret in production",
      );
    }

    // Validate database credentials
    if (
      config.POSTGRES_PASSWORD === defaultConfig.POSTGRES_PASSWORD ||
      config.POSTGRES_PASSWORD.length < 12
    ) {
      console.warn(
        "WARNING: Using default or weak database password in production environment",
      );
    }
  }

  return config;
};

// Export the loaded configuration
export const env = loadEnvConfig();

// Helper function to get environment info
export const getEnvInfo = () => ({
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  host: env.HOST,
  databaseConnected: !!env.DATABASE_URL,
  redisConfigured: !!(env.REDIS_URL || (env.REDIS_HOST && env.REDIS_PORT)),
  corsOrigins: env.CORS_ORIGIN,
  logLevel: env.LOG_LEVEL,
  agentHeartbeatInterval: env.AGENT_HEARTBEAT_INTERVAL,
  agentOfflineThreshold: env.AGENT_OFFLINE_THRESHOLD,
  rateLimitWindow: env.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: env.RATE_LIMIT_MAX_REQUESTS,
});
