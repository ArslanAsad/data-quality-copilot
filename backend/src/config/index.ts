/**
 * Central configuration for the API Gateway.
 * All values are loaded from environment variables.
 */

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  logLevel: process.env.LOG_LEVEL || "info",
  database: {
    url:
      process.env.DATABASE_URL ||
      "postgresql://postgres:4574@localhost:5432/data_quality_copilot",
  },
  aiService: {
    url: process.env.AI_SERVICE_URL || "http://localhost:8000",
    timeout: parseInt(process.env.AI_SERVICE_TIMEOUT || "120000", 10),
  },
  upload: {
    maxFileSize: parseInt(process.env.UPLOAD_MAX_SIZE || "52428800", 10), // 50MB default
    allowedMimeTypes: ["text/csv", "application/csv", "text/plain"],
  },
} as const;
