import { Knex } from 'knex';
import db from './client';

export const TABLE_NAME = 'indexer_state';

export async function get(name: string): Promise<number> {
  const row = await db(TABLE_NAME).select('last_processed_block').where('name', name).first();
  return Number(row?.last_processed_block ?? 0);
}

export async function set(dbTx: Knex.Transaction, name: string, last_processed_block: number) {
  await dbTx(TABLE_NAME)
    .insert({ name, last_processed_block })
    .onConflict('name')
    .merge({ last_processed_block, updated_at: db.fn.now() });
}
