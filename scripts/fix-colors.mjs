import { readFileSync, writeFileSync } from 'fs';

const file = 'components/kanban-board.tsx';
let content = readFileSync(file, 'utf8');

// 1. Column header gradient bar
content = content.replace(
  'from-amber-400 to-orange-400',
  'from-teal-400/40 to-emerald-400/40'
);

// 2. Column title text color
content = content.replace(
  `"text-amber-800 dark:text-amber-400"`,
  `"text-teal-700 dark:text-teal-400"`
);

// 3. Drop zone drag-over color (job board)
content = content.replace(
  `"bg-amber-50/50 dark:bg-amber-950/20 ring-1 ring-amber-300/30"`,
  `"bg-teal-50/30 dark:bg-teal-950/10 ring-1 ring-teal-300/15"`
);

// 4. Drop zone default color (job board)
content = content.replace(
  `"bg-amber-50/20 dark:bg-amber-950/10"`,
  `"bg-teal-50/10 dark:bg-teal-950/5"`
);

// 5. Also update the activate pulse animation color from amber to teal
content = content.replace(
  'rgba(251, 191, 36, 0.5)',
  'rgba(45, 212, 191, 0.4)'
);
content = content.replace(
  'rgba(251, 191, 36, 0)',
  'rgba(45, 212, 191, 0)'
);

writeFileSync(file, content);
console.log('Done - replaced all amber job colors with teal/emerald');
