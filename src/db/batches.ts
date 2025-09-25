import { remoteDb } from './client';

export interface Batch {
  batch_index: string; // bigint
  batch_hash: string;
  start_block_number: string; // bigint
  end_block_number: string; // bigint
}

enum RollupStatus {
  Finalized = 5,
}

export async function maxIndex(): Promise<number> {
  const latest = await remoteDb('batch')
    .max('index as maxIndex')
    .where('rollup_status', RollupStatus.Finalized)
    .first();

  return latest!.maxIndex;
}

export async function get(startIndex: number, endIndex: number): Promise<Batch[]> {
  const bs = await remoteDb('batch as b')
    .join('chunk as sc', 'sc.hash', 'b.start_chunk_hash')
    .join('chunk as ec', 'ec.hash', 'b.end_chunk_hash')
    .select(
      'b.index as batch_index',
      'b.hash as batch_hash',
      'sc.start_block_number',
      'ec.end_block_number',
    )
    .where('b.rollup_status', RollupStatus.Finalized)
    .whereBetween('b.index', [startIndex, endIndex])
    .orderBy('batch_index', 'asc');

  if (bs.length !== endIndex - startIndex + 1) {
    throw new Error(`Expected ${endIndex - startIndex + 1} batches, got ${bs.length}`);
  }

  return bs;
}
