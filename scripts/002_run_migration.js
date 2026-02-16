process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
import pg from 'pg'

const url = process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL
console.log('Using URL prefix:', url ? url.substring(0, 30) + '...' : 'NONE FOUND')
console.log('Available PG vars:', Object.keys(process.env).filter(k => k.includes('POSTGRES') || k.includes('DATABASE') || k.includes('SUPABASE')).join(', '))

const client = new pg.Client({ connectionString: url })
await client.connect()

try {
  // 1. Create sequence
  await client.query(`CREATE SEQUENCE IF NOT EXISTS public.quote_number_seq START WITH 1001`)
  console.log('Created sequence')

  // 2. Add quote_number column
  await client.query(`ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS quote_number INTEGER UNIQUE DEFAULT nextval('public.quote_number_seq')`)
  console.log('Added quote_number column')

  // 3. Backfill existing rows
  const res = await client.query(`UPDATE public.quotes SET quote_number = nextval('public.quote_number_seq') WHERE quote_number IS NULL`)
  console.log('Backfilled', res.rowCount, 'rows')

  // 4. Make NOT NULL
  await client.query(`ALTER TABLE public.quotes ALTER COLUMN quote_number SET NOT NULL`)
  console.log('Set NOT NULL')

  // 5. Create activity log table
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.quote_activity_log (
      id SERIAL PRIMARY KEY,
      quote_id UUID NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
      event TEXT NOT NULL,
      detail TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `)
  console.log('Created quote_activity_log table')

  // 6. Create index
  await client.query(`CREATE INDEX IF NOT EXISTS idx_quote_activity_log_quote_id ON public.quote_activity_log (quote_id, created_at DESC)`)
  console.log('Created index')

  // 7. Trigger function
  await client.query(`
    CREATE OR REPLACE FUNCTION public.log_quote_created()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
    BEGIN
      INSERT INTO public.quote_activity_log (quote_id, event, detail)
      VALUES (NEW.id, 'created', 'Quote Q-' || NEW.quote_number || ' created');
      RETURN NEW;
    END;
    $$;
  `)
  console.log('Created trigger function')

  // 8. Trigger
  await client.query(`DROP TRIGGER IF EXISTS trigger_quote_created_log ON public.quotes`)
  await client.query(`
    CREATE TRIGGER trigger_quote_created_log
      AFTER INSERT ON public.quotes
      FOR EACH ROW
      EXECUTE FUNCTION public.log_quote_created()
  `)
  console.log('Created trigger')

  console.log('Migration complete!')
} catch (err) {
  console.error('Migration error:', err.message)
  console.error(err.stack)
} finally {
  await client.end()
}
