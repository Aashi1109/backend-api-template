import { config as loadEnv } from "dotenv";
import { DB_CONNECTION_NAMES, REDIS_CONNECTION_NAMES } from "../constants";

loadEnv({ path: ".env.example" });

const config = {
  baseUrl:
    process.env.CLOUD_RUN_SERVICE_URL ||
    `http://localhost:${process.env.PORT || 3001}`,
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || "development",
  isDev: process.env.NODE_ENV === "development",
  express: {
    fileSizeLimit: process.env.EXPRESS_FILE_SIZE_LIMIT || "50mb",
  },
  corsOptions: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: process.env.CORS_METHODS || "GET,POST,PUT,DELETE,OPTIONS",
    allowedHeaders:
      process.env.CORS_ALLOWED_HEADERS || "Content-Type,Authorization",
    credentials: process.env.CORS_CREDENTIALS === "true",
  },
  log: {
    allLogsPath: process.env.LOG_ALL_LOGS_PATH || "./logs/server.log",
    errorLogsPath: process.env.LOG_ERROR_LOGS_PATH || "./logs/error.log",
  },
  redis: {
    [REDIS_CONNECTION_NAMES.Default]: {
      url: process.env.UPSTASH_REDIS_REST_URL || "",
      token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
    },
  },
  db: {
    [DB_CONNECTION_NAMES.Default]: process.env.DATABASE_URL || "",
  },
  infrastructure: {
    appName: "bhandara",
    serviceName: "bhandara-main-server",
  },
};

export default config;
