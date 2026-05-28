import pino from "pino";

const isDev = process.env.NODE_ENV !== "production";

export function createLogger(level = process.env.LOG_LEVEL ?? "info") {
  return pino({
    level,
    transport: isDev
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        }
      : undefined,
  });
}

export type Logger = ReturnType<typeof createLogger>;
