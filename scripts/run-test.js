const { execSync } = require("child_process")

try {
  const result = execSync("npx tsx scripts/test-calc.ts", {
    cwd: "/vercel/share/v0-project",
    encoding: "utf-8",
    timeout: 60000,
    stdio: ["pipe", "pipe", "pipe"],
  })
  console.log(result)
} catch (e) {
  if (e.stdout) console.log("STDOUT:", e.stdout)
  if (e.stderr) console.log("STDERR:", e.stderr)
  console.log("Exit code:", e.status)
}
