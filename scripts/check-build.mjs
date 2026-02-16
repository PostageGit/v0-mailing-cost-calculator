import { execSync } from "child_process";
try {
  const output = execSync("npx tsc --noEmit 2>&1", { cwd: "/vercel/share/v0-project", encoding: "utf-8", timeout: 60000 });
  console.log("No type errors found!");
  console.log(output);
} catch (e) {
  console.log("TYPE ERRORS FOUND:");
  console.log(e.stdout || e.message);
}
