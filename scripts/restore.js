import { execSync } from 'child_process';

try {
  // Check if we have git history
  const log = execSync('git log --oneline -5', { encoding: 'utf-8' });
  console.log('[v0] Recent commits:', log);
  
  // Try to restore the deleted file
  const result = execSync('git checkout HEAD -- components/mail-class-settings.tsx 2>&1', { encoding: 'utf-8' });
  console.log('[v0] Restore result:', result);
  
  // Verify file exists
  const exists = execSync('ls -la components/mail-class-settings.tsx', { encoding: 'utf-8' });
  console.log('[v0] File restored:', exists);
  
  // Show the import line
  const importLine = execSync('grep -n "from.*lucide" components/mail-class-settings.tsx | head -5', { encoding: 'utf-8' });
  console.log('[v0] Import lines:', importLine);
  
  // Show line 64 area
  const line64 = execSync('sed -n "60,70p" components/mail-class-settings.tsx', { encoding: 'utf-8' });
  console.log('[v0] Lines 60-70:', line64);
  
  // Count total lines
  const wc = execSync('wc -l components/mail-class-settings.tsx', { encoding: 'utf-8' });
  console.log('[v0] Total lines:', wc);
} catch(e) {
  console.error('[v0] Error:', e.message);
  console.error('[v0] stderr:', e.stderr?.toString());
}
