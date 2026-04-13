import winston, { format } from 'winston';

const { combine, timestamp, colorize, printf } = format;

function formatLog(info: winston.Logform.TransformableInfo): string {
  return `[${info['timestamp']}] ${info.level}: ${info.message}`;
}

const logFormat = printf(formatLog);

export const logger = winston.createLogger({
  level: 'info',
  format: combine(
    timestamp({ format: 'DD/MM/YYYY HH:mm:ss' }),
    colorize(),
    logFormat
  ),
  transports: [new winston.transports.Console()],
});
