import { readFileSync } from 'fs';

// Parse CSV with multiline quoted field support
function parseCSV(text) {
  const records = [];
  let current = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; }
        else inQuotes = false;
      } else {
        cell += c === '\r' ? '' : c === '\n' ? ' ' : c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') { current.push(cell); cell = ''; }
      else if (c === '\n' || (c === '\r' && text[i + 1] === '\n')) {
        if (c === '\r') i++;
        current.push(cell); cell = '';
        if (current.some(v => v.trim())) records.push(current);
        current = [];
      } else if (c !== '\r') cell += c;
    }
  }
  current.push(cell);
  if (current.some(v => v.trim())) records.push(current);

  if (records.length < 2) return [];
  const headers = records[0].map(h => h.trim());
  return records.slice(1).map(vals => {
    const row = {};
    headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
    return row;
  });
}

// Field mapping
const FIELD_MAP = {
  'name': 'contact_name',
  'company name': 'company_name',
  'street address': 'street',
  'city': 'city',
  'state': 'state',
  'country': 'country',
  'zip': 'postal_code',
  'phone': 'office_phone',
  'email': 'email',
};

const csv = readFileSync('scripts/customers.csv', 'utf8');
const rows = parseCSV(csv);

function escSQL(s) {
  if (!s) return 'NULL';
  return "'" + s.replace(/'/g, "''") + "'";
}

const inserts = [];
for (const row of rows) {
  const customer = { billing_same_as_primary: true };
  const extras = {};

  for (const [csvKey, value] of Object.entries(row)) {
    if (!value) continue;
    const dbField = FIELD_MAP[csvKey.toLowerCase().trim()];
    if (!dbField) {
      if (csvKey.toLowerCase() === 'customer type' && value) extras['QB Customer Type'] = value;
      if (csvKey.toLowerCase() === 'open balance') {
        const parsed = parseFloat(value.replace(/[,"]/g, ''));
        if (parsed !== 0) extras['QB Open Balance'] = value.replace(/"/g, '');
      }
      continue;
    }
    customer[dbField] = value;
  }

  if (!customer.company_name) {
    if (customer.contact_name) customer.company_name = customer.contact_name;
    else continue; // skip
  }

  const customFields = Object.keys(extras).length > 0 ? JSON.stringify(extras) : '{}';

  inserts.push(`(${escSQL(customer.company_name)}, ${escSQL(customer.contact_name)}, ${escSQL(customer.email)}, ${escSQL(customer.office_phone)}, ${escSQL(customer.street)}, ${escSQL(customer.city)}, ${escSQL(customer.state)}, ${escSQL(customer.postal_code)}, ${escSQL(customer.country || 'US')}, ${escSQL(customFields)}, true)`);
}

// Print SQL batches of 50
const BATCH = 50;
for (let i = 0; i < inserts.length; i += BATCH) {
  const batch = inserts.slice(i, i + BATCH);
  const sql = `INSERT INTO customers (company_name, contact_name, email, office_phone, street, city, state, postal_code, country, custom_fields, billing_same_as_primary) VALUES\n${batch.join(',\n')};\n`;
  console.log(`-- Batch ${Math.floor(i / BATCH) + 1} (${batch.length} rows)`);
  console.log(sql);
}

console.log(`-- Total: ${inserts.length} customers`);
