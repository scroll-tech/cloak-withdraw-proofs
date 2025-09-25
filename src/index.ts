import express from 'express';
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

async function main() {
  await runMigrations();

  const app = express();
  app.use(bodyParser.json());
  app.post('/', rpc);
  app.listen(config.port);
  logger.info(`JSON-RPC server listening on port ${config.port}`);

  await Promise.all([indexBatches()]);
}

main().catch((err) => {
  logger.error('Error occurred in main:', err);
});
