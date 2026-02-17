import { execSync } from 'child_process'

try {
  // Try to restore the deleted file from git
  const result = execSync('cd /vercel/share/v0-project && git checkout HEAD -- components/mail-class-settings.tsx 2>&1', { encoding: 'utf8' })
  console.log('Restored:', result)
} catch (e) {
  console.log('Git restore failed:', e.message)
  try {
    // Try git log to see if file was committed
    const log = execSync('cd /vercel/share/v0-project && git log --oneline -5 2>&1', { encoding: 'utf8' })
    console.log('Recent commits:', log)
    // Try to find the file in history
    const show = execSync('cd /vercel/share/v0-project && git show HEAD:components/mail-class-settings.tsx 2>&1 | head -40', { encoding: 'utf8' })
    console.log('File from HEAD:', show)
  } catch (e2) {
    console.log('Git show failed:', e2.message)
  }
}
