import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';

import { config } from './config';
import logger from './logger';
import db from './db/client';
import rpc from './rpc';

import { indexBatches } from './workers/batches';

async function runMigrations() {
  logger.info('Running migrations...');
  const [batchNo, log] = await db.migrate.latest();
  logger.info(`Batch ${batchNo} run: ${log.length} migrations`);
}

async function startServer() {
  const app = express();

  app.use(bodyParser.json());
  app.disable('x-powered-by');

  // Register JSON-RPC endpoint
  app.post('/', rpc);

  // Register health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  const server = app.listen(config.port);
  logger.info(`JSON-RPC server listening on port ${config.port}`);

  const close = (signal: string) => () => {
    logger.debug(`${signal} signal received: closing HTTP server`);
    server.close(() => {
      logger.info('HTTP server closed');
      process.exit(0);
    });
  };

  process.on('SIGTERM', close('SIGTERM'));
  process.on('SIGINT', close('SIGINT'));
}

async function main() {
  await runMigrations();
  await startServer();
  await Promise.all([indexBatches()]);
}

main().catch((err) => {
  logger.error('Error occurred in main:', err);
  process.exit(1);
});
