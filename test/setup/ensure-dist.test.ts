import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { distNeedsRebuild, resolveBuildInvocation } from "./ensure-dist.js";

const OLDER = new Date("2026-01-01T00:00:00.000Z");
const NEWER = new Date("2026-06-01T00:00:00.000Z");

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function tempRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "token-glace-ensure-dist-"));
  roots.push(root);
  return root;
}

function writeTimedFile(path: string, mtime: Date): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, "fixture\n");
  utimesSync(path, mtime, mtime);
}

describe("distNeedsRebuild", () => {
  it("rebuilds when a TypeScript source file is newer than the CLI entry", () => {
    const root = tempRoot();
    writeTimedFile(join(root, "dist", "cli", "main.js"), OLDER);
    writeTimedFile(join(root, "src", "cli", "main.ts"), NEWER);

    expect(distNeedsRebuild(root)).toBe(true);
  });

  it("rebuilds when the CLI entry is missing", () => {
    const root = tempRoot();
    writeTimedFile(join(root, "src", "cli", "main.ts"), OLDER);

    expect(distNeedsRebuild(root)).toBe(true);
  });

  it("skips rebuild when the CLI entry is newer than build inputs", () => {
    const root = tempRoot();
    writeTimedFile(join(root, "src", "cli", "main.ts"), OLDER);
    writeTimedFile(join(root, "tsconfig.json"), OLDER);
    writeTimedFile(join(root, "dist", "cli", "main.js"), NEWER);

    expect(distNeedsRebuild(root)).toBe(false);
  });

  it("ignores newer files that are not build inputs", () => {
    const root = tempRoot();
    writeTimedFile(join(root, "src", "cli", "main.ts"), OLDER);
    writeTimedFile(join(root, "dist", "cli", "main.js"), OLDER);
    writeTimedFile(join(root, "src", "cli", "notes.md"), NEWER);

    expect(distNeedsRebuild(root)).toBe(false);
  });

  it("rebuilds when package.json or the lockfile is newer than the CLI entry", () => {
    const packageRoot = tempRoot();
    writeTimedFile(join(packageRoot, "src", "cli", "main.ts"), OLDER);
    writeTimedFile(join(packageRoot, "dist", "cli", "main.js"), OLDER);
    writeTimedFile(join(packageRoot, "package.json"), NEWER);
    expect(distNeedsRebuild(packageRoot)).toBe(true);

    const lockRoot = tempRoot();
    writeTimedFile(join(lockRoot, "src", "cli", "main.ts"), OLDER);
    writeTimedFile(join(lockRoot, "dist", "cli", "main.js"), OLDER);
    writeTimedFile(join(lockRoot, "pnpm-lock.yaml"), NEWER);
    expect(distNeedsRebuild(lockRoot)).toBe(true);
  });

  it("rebuilds when a named build script is newer than the CLI entry", () => {
    const root = tempRoot();
    writeTimedFile(join(root, "src", "cli", "main.ts"), OLDER);
    writeTimedFile(join(root, "dist", "cli", "main.js"), OLDER);
    writeTimedFile(join(root, "scripts", "clean-dist.mjs"), NEWER);

    expect(distNeedsRebuild(root)).toBe(true);
  });
});

describe("resolveBuildInvocation", () => {
  it("runs build through process.execPath and npm_execpath when available", () => {
    expect(
      resolveBuildInvocation({
        execPath: "/usr/bin/node",
        npmExecPath: "/opt/pnpm/bin/pnpm.cjs",
        platform: "linux",
      }),
    ).toEqual({
      executable: "/usr/bin/node",
      args: ["/opt/pnpm/bin/pnpm.cjs", "run", "build"],
    });
  });

  it("falls back to a platform-specific pnpm executable without a shell", () => {
    expect(
      resolveBuildInvocation({
        execPath: "/usr/bin/node",
        platform: "linux",
      }),
    ).toEqual({ executable: "pnpm", args: ["run", "build"] });

    expect(
      resolveBuildInvocation({
        execPath: "C:\\Program Files\\nodejs\\node.exe",
        platform: "win32",
      }),
    ).toEqual({ executable: "pnpm.cmd", args: ["run", "build"] });
  });
});
