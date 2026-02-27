import { execSync } from "child_process";

const branch = "v0/postflow-421f9e88";
const cwd = "/vercel/share/v0-project";

try {
  console.log("Current branch:", execSync("git branch --show-current", { cwd }).toString().trim());
  console.log("Fetching...");
  execSync(`git fetch origin ${branch}`, { cwd, stdio: "inherit" });
  console.log(`Checking out ${branch}...`);
  execSync(`git checkout ${branch}`, { cwd, stdio: "inherit" });
  console.log("Done. Current branch:", execSync("git branch --show-current", { cwd }).toString().trim());
} catch (e) {
  console.error("Error:", e.message);
  // Try force checkout
  try {
    execSync(`git checkout -f ${branch}`, { cwd, stdio: "inherit" });
    console.log("Force checkout done.");
  } catch (e2) {
    console.error("Force checkout also failed:", e2.message);
  }
}
