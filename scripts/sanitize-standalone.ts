import { existsSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";

const projectRoot = process.cwd();
const standaloneRoot = path.resolve(projectRoot, ".next", "standalone");
const expectedRoot = path.join(projectRoot, ".next", "standalone");

if (standaloneRoot !== expectedRoot || !existsSync(standaloneRoot)) {
  throw new Error(`Unexpected or missing standalone output: ${standaloneRoot}`);
}

let removedEnvironmentFiles = 0;
for (const entry of readdirSync(standaloneRoot, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.startsWith(".env")) {
    rmSync(path.join(standaloneRoot, entry.name), { force: true });
    removedEnvironmentFiles += 1;
  }
}

const bundledUploads = path.join(standaloneRoot, "storage", "uploads");
if (existsSync(bundledUploads)) {
  rmSync(bundledUploads, { recursive: true, force: true });
}

console.log(`Sanitized standalone output: removed ${removedEnvironmentFiles} environment file(s) and bundled uploads.`);
