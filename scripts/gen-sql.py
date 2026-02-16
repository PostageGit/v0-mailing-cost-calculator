import csv
import json
import io
import os

# Read the CSV content directly from the file
# Try multiple possible paths
for p in [
    '/vercel/share/v0-project/scripts/customers.csv',
    'scripts/customers.csv',
    os.path.join(os.getcwd(), 'scripts', 'customers.csv'),
    '/vercel/share/v0-project/user_read_only_context/text_attachments/Customers-liWNr.csv',
]:
    if os.path.exists(p):
        csv_path = p
        break
else:
    # Print cwd and list files to debug
    print(f"CWD: {os.getcwd()}")
    for root, dirs, files in os.walk('.'):
        for f in files:
            if f.endswith('.csv'):
                print(f"  Found CSV: {os.path.join(root, f)}")
    raise FileNotFoundError("Cannot find customers.csv")

print(f"Found CSV at: {csv_path}")

FIELD_MAP = {
    'name': 'contact_name',
    'company name': 'company_name',
    'street address': 'street',
    'city': 'city',
    'state': 'state',
    'country': 'country',
    'zip': 'postal_code',
    'phone': 'office_phone',
    'email': 'email',
}

def esc(s):
    if s is None:
        return 'NULL'
    return "'" + s.replace("'", "''").replace("\n", " ").replace("\r", "") + "'"

inserts = []

with open(csv_path, 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        customer = {}
        extras = {}
        for csv_key, value in row.items():
            if not value or not csv_key:
                continue
            key_lower = csv_key.strip().lower()
            db_field = FIELD_MAP.get(key_lower)
            if db_field:
                customer[db_field] = value.strip()
            elif key_lower == 'customer type' and value.strip():
                extras['QB Customer Type'] = value.strip()
            elif key_lower == 'open balance':
                try:
                    parsed = float(value.replace(',', '').replace('"', ''))
                    if parsed != 0:
                        extras['QB Open Balance'] = value.replace('"', '').strip()
                except ValueError:
                    pass

        company = customer.get('company_name', '')
        contact = customer.get('contact_name', '')
        if not company:
            if contact:
                customer['company_name'] = contact
            else:
                continue

        custom_fields = json.dumps(extras) if extras else '{}'

        inserts.append(
            f"({esc(customer.get('company_name'))}, {esc(customer.get('contact_name'))}, "
            f"{esc(customer.get('email'))}, {esc(customer.get('office_phone'))}, "
            f"{esc(customer.get('street'))}, {esc(customer.get('city'))}, "
            f"{esc(customer.get('state'))}, {esc(customer.get('postal_code'))}, "
            f"{esc(customer.get('country') or 'US')}, "
            f"{esc(custom_fields)}, true)"
        )

print(f"Parsed {len(inserts)} customers")

# Write SQL batches to separate files for execution
BATCH = 50
for i in range(0, len(inserts), BATCH):
    batch = inserts[i:i+BATCH]
    batch_num = i // BATCH + 1
    sql = f"-- Batch {batch_num} ({len(batch)} rows)\n"
    sql += "INSERT INTO customers (company_name, contact_name, email, office_phone, street, city, state, postal_code, country, custom_fields, billing_same_as_primary) VALUES\n"
    sql += ",\n".join(batch)
    sql += ";\n"

    fname = f"scripts/batch-{batch_num:02d}.sql"
    with open(fname, 'w') as f:
        f.write(sql)

total_batches = (len(inserts) + BATCH - 1) // BATCH
print(f"Generated {total_batches} SQL batch files (scripts/batch-01.sql through scripts/batch-{total_batches:02d}.sql)")
print(f"Sample row: {inserts[0][:150]}...")
