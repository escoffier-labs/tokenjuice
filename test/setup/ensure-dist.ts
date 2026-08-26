import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * test/cli spawn-based characterization tests execute dist/cli/main.js as a
 * real child process. `pnpm verify` deliberately has no build step, so a fresh
 * checkout (CI) has no dist and every spawn exits 1 with module-not-found.
 * Build when the CLI entry is missing or when a real build input is newer.
 */
const CLI_ENTRY_SEGMENTS = ["dist", "cli", "main.js"] as const;

const BUILD_INPUT_FILES = [
  "tsconfig.json",
  "scripts/generate-builtin-rules.mjs",
  "scripts/build-pi-runtime.mjs",
  "scripts/build-opencode-runtime.mjs",
  "scripts/copy-rules.mjs",
] as const;

const SOURCE_EXTENSIONS = [".ts", ".json"] as const;

function collectTreeInputs(dir: string, inputs: string[]): void {
  if (!existsSync(dir)) {
    return;
  }

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectTreeInputs(path, inputs);
      continue;
    }
    if (SOURCE_EXTENSIONS.some((extension) => entry.name.endsWith(extension))) {
      inputs.push(path);
    }
  }
}

function collectBuildInputs(root: string): string[] {
  const inputs: string[] = [];

  for (const relativePath of BUILD_INPUT_FILES) {
    const path = join(root, relativePath);
    if (existsSync(path)) {
      inputs.push(path);
    }
  }

  collectTreeInputs(join(root, "src"), inputs);
  return inputs;
}

export function distNeedsRebuild(root: string): boolean {
  const entry = join(root, ...CLI_ENTRY_SEGMENTS);
  if (!existsSync(entry)) {
    return true;
  }

  const entryMtime = statSync(entry).mtimeMs;
  return collectBuildInputs(root).some((input) => statSync(input).mtimeMs > entryMtime);
}

export default function setup(): void {
  if (!distNeedsRebuild(process.cwd())) {
    return;
  }
  execFileSync("pnpm", ["run", "build"], { stdio: "inherit", cwd: process.cwd() });
}
