import { execSync } from 'child_process'
const files = [
  'components/printing/price-breakdown.tsx',
  'components/printing/printing-calculator.tsx',
  'components/printing/printing-form.tsx',
  'components/booklet/booklet-calculator.tsx',
  'components/booklet/booklet-details.tsx',
  'components/booklet/booklet-form.tsx',
  'components/quote-sidebar.tsx',
  'components/vendor-bid-panel.tsx',
  'lib/printing-pricing.ts',
  'lib/booklet-pricing.ts',
  'lib/printing-types.ts',
  'lib/booklet-types.ts',
]
try {
  const out = execSync(`./node_modules/.bin/tsc --noEmit --pretty false ${files.join(' ')} 2>&1`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 * 5, cwd: '/vercel/share/v0-project' })
  console.log('No errors: ' + out)
} catch (e) {
  console.log('STDOUT: ' + (e.stdout || '').slice(0, 3000))
  console.log('STDERR: ' + (e.stderr || '').slice(0, 3000))
}
