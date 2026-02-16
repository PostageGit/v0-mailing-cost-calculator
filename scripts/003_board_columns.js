process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
import pg from 'pg'

const url = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL
const client = new pg.Client({ connectionString: url })

async function run() {
  await client.connect()
  console.log('Connected.')

  // 1. Create board_columns table
  await client.query(`
    CREATE TABLE IF NOT EXISTS board_columns (
      id text PRIMARY KEY DEFAULT 'col-' || substr(gen_random_uuid()::text, 1, 8),
      title text NOT NULL,
      color text NOT NULL DEFAULT '#6b7280',
      sort_order int NOT NULL DEFAULT 0,
      created_at timestamptz DEFAULT now()
    );
  `)
  console.log('Created board_columns table.')

  // 2. Seed default columns (only if empty)
  const { rowCount } = await client.query('SELECT 1 FROM board_columns LIMIT 1')
  if (rowCount === 0) {
    await client.query(`
      INSERT INTO board_columns (id, title, color, sort_order) VALUES
        ('col-draft', 'Draft', '#6b7280', 0),
        ('col-sent', 'Sent', '#3b82f6', 1),
        ('col-approved', 'Approved', '#22c55e', 2),
        ('col-production', 'Production', '#f97316', 3),
        ('col-mailing', 'Mailing', '#8b5cf6', 4),
        ('col-completed', 'Completed', '#14b8a6', 5);
    `)
    console.log('Seeded 6 default columns.')
  } else {
    console.log('Columns already exist, skipping seed.')
  }

  // 3. Add column_id to quotes (default to col-draft)
  await client.query(`
    ALTER TABLE quotes
      ADD COLUMN IF NOT EXISTS column_id text DEFAULT 'col-draft',
      ADD COLUMN IF NOT EXISTS mailing_date text DEFAULT '',
      ADD COLUMN IF NOT EXISTS lights jsonb DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS sort_order int DEFAULT 0;
  `)
  console.log('Added column_id, mailing_date, lights, sort_order to quotes.')

  // 4. Migrate existing status values to column_id
  await client.query(`
    UPDATE quotes SET column_id = 'col-' || status
    WHERE column_id = 'col-draft' AND status IS NOT NULL AND status != 'draft';
  `)
  console.log('Migrated existing status to column_id.')

  // 5. Add FK constraint (ignore if already exists)
  try {
    await client.query(`
      ALTER TABLE quotes
        ADD CONSTRAINT fk_quotes_column_id
        FOREIGN KEY (column_id) REFERENCES board_columns(id) ON DELETE SET DEFAULT;
    `)
    console.log('Added FK constraint.')
  } catch (e) {
    console.log('FK constraint already exists or skipped:', e.message)
  }

  await client.end()
  console.log('Done!')
}

run().catch((e) => { console.error(e); process.exit(1) })
