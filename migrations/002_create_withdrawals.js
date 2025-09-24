const TABLE_NAME = 'withdrawals';

exports.up = async function (knex) {
  await knex.schema.createTable(TABLE_NAME, t => {
    t.increments('id').primary();

    t.string('validium_tx_hash', 66).notNullable(); // bytes32 with 0x prefix
    t.decimal('validium_block_number').notNullable();
    t.string('message_hash', 66).notNullable().unique(); // bytes32 with 0x prefix

    t.string('from', 42).notNullable(); // address with 0x prefix
    t.string('to', 42).notNullable(); // address with 0x prefix
    t.bigint('value').notNullable(); // uint256
    t.bigint('nonce').notNullable(); // uint256
    t.text('message').notNullable(); // bytes

    t.decimal('batch_index');
    t.text('proof');

    t.timestamps(true, true); // created_at, updated_at
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists(TABLE_NAME);
};
