CREATE TABLE IF NOT EXISTS items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text DEFAULT '',
  sku text DEFAULT '',
  unit_cost numeric NOT NULL DEFAULT 0,
  unit_label text NOT NULL DEFAULT 'each',
  category text NOT NULL DEFAULT 'General',
  labor_class_id uuid DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
