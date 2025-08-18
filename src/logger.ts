/**
 * Structured logging configuration for production
 * Uses Pino for high-performance JSON logging
 */

import pino from 'pino';

// Environment-based configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
const logLevel = process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info');

// Create logger instance
export const logger = pino({
  level: logLevel,
  // Use pretty printing in development, JSON in production
  transport: isDevelopment ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:standard',
      singleLine: false
    }
  } : undefined,
  // Add metadata to all logs
  base: {
    service: 'mcp-xcode',
    version: '2.2.0'
  },
  // Redact sensitive information
  redact: {
    paths: ['deviceId', 'udid', '*.password', '*.secret', '*.token'],
    censor: '[REDACTED]'
  },
  // Add timestamp
  timestamp: pino.stdTimeFunctions.isoTime,
  // Serializers for common objects
  serializers: {
    error: pino.stdSerializers.err,
    request: (req: any) => ({
      tool: req.tool,
      platform: req.platform,
      projectPath: req.projectPath?.replace(/\/Users\/[^/]+/, '/Users/[USER]')
    })
  }
});

// Create child loggers for different modules
export const createModuleLogger = (module: string) => {
  const moduleLogger = logger.child({ module });
  
  // In test environment, wrap methods to add test name dynamically
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    const methods = ['info', 'error', 'warn', 'debug', 'trace', 'fatal'] as const;
    
    methods.forEach(method => {
      const originalMethod = moduleLogger[method].bind(moduleLogger);
      (moduleLogger as any)[method] = function(obj: any, ...rest: any[]) {
        try {
          // @ts-ignore - expect is only available in test environment
          const testName = global.expect?.getState?.()?.currentTestName;
          if (testName && obj && typeof obj === 'object') {
            // Add test name to the context object
            obj = { ...obj, testName };
          }
        } catch {
          // Ignore if expect is not available
        }
        return originalMethod(obj, ...rest);
      };
    });
  }
  
  return moduleLogger;
};

// Export log levels for use in code
export const LogLevel = {
  FATAL: 'fatal',
  ERROR: 'error',
  WARN: 'warn',
  INFO: 'info',
  DEBUG: 'debug',
  TRACE: 'trace'
} as const;

// Helper for logging tool executions
export const logToolExecution = (toolName: string, args: any, duration?: number) => {
  logger.info({
    event: 'tool_execution',
    tool: toolName,
    args: args,
    duration_ms: duration
  }, `Executed tool: ${toolName}`);
};

// Helper for logging errors with context
export const logError = (error: Error, context: Record<string, any>) => {
  logger.error({
    error,
    ...context
  }, error.message);
};