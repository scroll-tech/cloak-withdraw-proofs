import { Knex } from 'knex';
import db from './client';

export const TABLE_NAME = 'withdrawals';

export interface WithdrawalInsert {
  validium_tx_hash: string;
  validium_block_number: number;
  message_hash: string;
  from: string;
  to: string;
  value: string;
  nonce: string;
  message: string;
  batch_index: number;
  proof: string;
}

export interface Withdrawal extends WithdrawalInsert {
  id: number;
  created_at: string;
  updated_at: string;
}

export async function insert(dbTx: Knex.Transaction, w: WithdrawalInsert) {
  await dbTx(TABLE_NAME).insert({ ...w });
  // note: fail on conflict
}

export async function latest(): Promise<Withdrawal | undefined> {
  const result = await db(TABLE_NAME).max('nonce as max').first();
  const maxNonce = result?.max;
  if (!maxNonce) return undefined;

  return db<Withdrawal>(TABLE_NAME).select('*').where('nonce', maxNonce).first();
}

const publicFields = [
  'validium_tx_hash as tx_hash',
  'message_hash',
  'from',
  'to',
  'value',
  'nonce',
  'message',
  'batch_index',
  'proof',
];

export async function findByTxHash(txHash: string): Promise<Withdrawal[]> {
  return db<Withdrawal>(TABLE_NAME)
    .select(...publicFields)
    .whereRaw('LOWER(validium_tx_hash) = LOWER(?)', [txHash]);
}

export async function findByMessageHash(messageHash: string): Promise<Withdrawal[]> {
  return db<Withdrawal>(TABLE_NAME)
    .select(...publicFields)
    .whereRaw('LOWER(message_hash) = LOWER(?)', [messageHash]);
}
