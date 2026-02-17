import { rmSync, existsSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
const dirs = ['.next', '.turbo', 'node_modules/.cache']

for (const dir of dirs) {
  const full = join(root, dir)
  if (existsSync(full)) {
    console.log(`Removing ${dir}...`)
    rmSync(full, { recursive: true, force: true })
    console.log(`Removed ${dir}`)
  } else {
    console.log(`${dir} not found, skipping`)
  }
}

console.log('Cache cleared!')
