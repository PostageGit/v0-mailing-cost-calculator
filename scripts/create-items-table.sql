CREATE TABLE IF NOT EXISTS items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  sku text,
  unit_cost numeric NOT NULL DEFAULT 0,
  unit_label text NOT NULL DEFAULT 'each',
  category text NOT NULL DEFAULT 'General',
  labor_class_id uuid REFERENCES mail_class_settings(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_labor_class ON items(labor_class_id);
