const { execSync } = require("child_process")

// First check if tsx is available
try {
  console.log("Checking tsx...")
  const v = execSync("npx tsx --version", { cwd: "/vercel/share/v0-project", encoding: "utf-8", timeout: 30000 })
  console.log("tsx version:", v.trim())
} catch(e) {
  console.log("tsx not available, trying ts-node...")
  try {
    const v2 = execSync("npx ts-node --version", { cwd: "/vercel/share/v0-project", encoding: "utf-8", timeout: 30000 })
    console.log("ts-node version:", v2.trim())
  } catch(e2) {
    console.log("No TS runner available")
    console.log("Trying next approach: use next's own tsconfig...")
  }
}

// Try using node with --loader
try {
  console.log("\nRunning test via node loader...")
  const result = execSync(
    'node --loader ts-node/esm scripts/test-calc.ts 2>&1 || node -e "require(\'ts-node\').register(); require(\'./scripts/test-calc.ts\')" 2>&1 || echo "All methods failed"',
    { cwd: "/vercel/share/v0-project", encoding: "utf-8", timeout: 30000 }
  )
  console.log(result)
} catch(e) {
  console.log("STDOUT:", e.stdout || "(none)")
  console.log("STDERR:", e.stderr || "(none)")
}
