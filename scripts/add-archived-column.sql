ALTER TABLE public.chat_quotes ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false NOT NULL;
