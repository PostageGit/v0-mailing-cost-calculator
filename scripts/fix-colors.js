import { readFileSync, writeFileSync } from 'fs';

const file = '/vercel/share/v0-project/components/kanban-board.tsx';
let content = readFileSync(file, 'utf8');

const replacements = [
  // Column header gradient bar
  ['from-amber-400 to-orange-400', 'from-teal-400/40 to-emerald-400/40'],
  // Column header text
  ['text-amber-800 dark:text-amber-400', 'text-teal-700 dark:text-teal-400'],
  // Drop zone drag-over
  ['bg-amber-50/50 dark:bg-amber-950/20 ring-1 ring-amber-300/30', 'bg-teal-50/30 dark:bg-teal-950/10 ring-1 ring-teal-300/15'],
  // Drop zone idle
  ['bg-amber-50/20 dark:bg-amber-950/10', 'bg-teal-50/10 dark:bg-teal-950/5'],
  // Activate pulse animation color
  ['rgba(251, 191, 36, 0.5)', 'rgba(45, 212, 191, 0.45)'],
  ['rgba(251, 191, 36, 0)', 'rgba(45, 212, 191, 0)'],
];

let count = 0;
for (const [from, to] of replacements) {
  if (content.includes(from)) {
    content = content.replaceAll(from, to);
    count++;
    console.log(`Replaced: "${from}" -> "${to}"`);
  } else {
    console.log(`Not found: "${from}"`);
  }
}

writeFileSync(file, content, 'utf8');
console.log(`Done. ${count} replacements applied.`);
