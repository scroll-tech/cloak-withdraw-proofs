import { ethers } from 'ethers';
import { Knex } from 'knex';

import { config } from '../config';
import { sleep } from '../utils';
import { abi } from '../abi';

import db from '../db/client';
import * as indexer_state from '../db/indexer_state';
import * as withdrawals from '../db/withdrawals';
import * as batches from '../db/batches';

import { WithdrawTrie } from '../withdraw-trie';

import baseLogger from '../logger';
const logger = baseLogger.child({ module: 'withdrawals' });

const validiumProvider = new ethers.JsonRpcProvider(config.endpoints.validium);
const iface = new ethers.Interface(abi);
const AppendMessageTopic = iface.getEvent('AppendMessage')!.topicHash;
const SentMessageTopic = iface.getEvent('SentMessage')!.topicHash;

async function processBatch(
  dbTx: Knex.Transaction,
  batch: batches.Batch,
  withdrawTrie: WithdrawTrie,
) {
  logger.info(
    `Processing batch ${batch.batch_index} (blocks ${batch.start_block_number}-${batch.end_block_number})`,
  );

  const logs = await validiumProvider.getLogs({
    address: [config.contracts.validiumMessageQueue, config.contracts.validiumMessenger],
    topics: [[AppendMessageTopic, SentMessageTopic]],
    fromBlock: Number(batch.start_block_number),
    toBlock: Number(batch.end_block_number),
  });

  if (logs.length === 0) return;

  // Note: The contracts guarantee that the logs are emitted
  // from the correct contract, and the counts match.
  const appendMessageLogs = logs.filter((l) => l.topics[0] === AppendMessageTopic);
  const sentMessageLogs = logs.filter((l) => l.topics[0] === SentMessageTopic);
  const messageHashes = appendMessageLogs.map((l) =>
    iface.parseLog(l)!.args.getValue('messageHash'),
  );
  const proofs = withdrawTrie.appendMessages(messageHashes);

  logger.info(`Found ${appendMessageLogs.length} withdrawals in batch ${batch.batch_index}`);

  for (let ii = 0; ii < sentMessageLogs.length; ii++) {
    const log = sentMessageLogs[ii];
    const parsedLog = iface.parseLog(log)!;

    const withdrawal = {
      validium_tx_hash: log.transactionHash,
      validium_block_number: log.blockNumber,
      message_hash: messageHashes[ii],
      from: parsedLog.args.getValue('sender'),
      to: parsedLog.args.getValue('target'),
      value: parsedLog.args.getValue('value').toString(), // bigint as string decimal
      nonce: Number(parsedLog.args.getValue('messageNonce')),
      message: parsedLog.args.getValue('message'),
      batch_index: Number(batch.batch_index),
      proof: proofs[ii],
    };

    logger.debug(`New withdrawal, message hash: ${withdrawal.message_hash}`);

    await withdrawals.insert(dbTx, withdrawal);
  }
}

export async function indexBatches() {
  logger.info('Background worker started: indexBatches');

  // Time to wait idle between consecutive runs of this job,
  // if there are no pending items.
  const sleepMs = 1000;

  // The number of batches to fetch in one go.
  const batchSize = 10;

  // Resume from the last processed batch.
  const lastPersistedBatchIndex = await indexer_state.get('batches');
  let latestProcessedBatchIndex = lastPersistedBatchIndex;
  logger.info(`Resuming from last processed batch: ${latestProcessedBatchIndex}`);

  // Initialize the in-memory withdraw trie.
  const withdrawTrie = new WithdrawTrie();
  const lastWithdrawal = await withdrawals.latest();

  if (lastWithdrawal) {
    withdrawTrie.reset(
      Number(lastWithdrawal.nonce),
      lastWithdrawal.message_hash,
      lastWithdrawal.proof,
    );
  } else {
    withdrawTrie.initialize(0, 0, []);
  }

  // Index up until the latest finalized batch.
  let latest = await batches.maxIndex();

  while (true) {
    if (latest <= latestProcessedBatchIndex) {
      await sleep(sleepMs);
      latest = await batches.maxIndex();
      continue;
    }

    const fromBatchIndex = latestProcessedBatchIndex + 1;
    const toBatchIndex = Math.min(latest, fromBatchIndex + batchSize - 1);
    const bs = await batches.get(fromBatchIndex, toBatchIndex);

    try {
      await db.transaction(async (dbTx: Knex.Transaction) => {
        for (const batch of bs) await processBatch(dbTx, batch, withdrawTrie);
        await indexer_state.set(dbTx, 'batches', toBatchIndex);
        latestProcessedBatchIndex = toBatchIndex;
      });
    } catch (err) {
      logger.error(`Unexpected error while processing batches: ${err}`);
      await sleep(sleepMs);
    }
  }
}
