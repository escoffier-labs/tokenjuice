import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { distNeedsRebuild } from "./ensure-dist.js";

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
    writeTimedFile(join(root, "README.md"), NEWER);

    expect(distNeedsRebuild(root)).toBe(false);
  });
});
