import { execSync } from 'child_process'
try {
  const out = execSync('npx tsc --noEmit 2>&1', { encoding: 'utf-8', maxBuffer: 1024 * 1024 })
  console.log('No errors found!')
  console.log(out)
} catch (e) {
  console.log('TypeScript errors found:')
  console.log(e.stdout || '')
  console.log(e.stderr || '')
}
