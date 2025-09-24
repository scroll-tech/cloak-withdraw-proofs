import { getAddress } from 'ethers';

import dotenv from 'dotenv';
dotenv.config({ quiet: true });

function getEnv(key: string): string {
  const value = process.env[key];
  if (typeof value !== 'string' || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  endpoints: {
    validium: getEnv('VALIDIUM_ENDPOINT'),
  },

  contracts: {
    validiumMessageQueue: getAddress(getEnv('VALIDIUM_MESSAGE_QUEUE')),
    validiumMessenger: getAddress(getEnv('VALIDIUM_MESSENGER')),
  },

  db: {
    client: getEnv('DB_CLIENT'),
    pg_connection: getEnv('PG_CONNECTION'),
    sqlite_filename: getEnv('SQLITE_FILENAME'),
    rollup_db_connection: getEnv('ROLLUP_DB_CONNECTION'),
  },
};
