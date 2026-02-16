import csv
import json
import os

csv_path = os.path.join(os.path.dirname(__file__), 'customers.csv')

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
    return "'" + s.replace("'", "''") + "'"

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
            f"{esc(customer.get('country', 'US') or 'US')}, "
            f"{esc(custom_fields)}, true)"
        )

# Write SQL file
sql_path = os.path.join(os.path.dirname(__file__), 'customers-insert.sql')
with open(sql_path, 'w') as f:
    BATCH = 50
    for i in range(0, len(inserts), BATCH):
        batch = inserts[i:i+BATCH]
        f.write(f"-- Batch {i // BATCH + 1} ({len(batch)} rows)\n")
        f.write("INSERT INTO customers (company_name, contact_name, email, office_phone, street, city, state, postal_code, country, custom_fields, billing_same_as_primary) VALUES\n")
        f.write(",\n".join(batch))
        f.write(";\n\n")

print(f"Generated {len(inserts)} customer INSERT statements")
print(f"Written to {sql_path}")
print(f"First 3 samples:")
for s in inserts[:3]:
    print(f"  {s[:120]}...")
