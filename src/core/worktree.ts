import * as path from 'path';

export interface FsLike {
  existsSync(p: string): boolean;
  statSync(p: string): { isDirectory(): boolean; isFile(): boolean };
  readFileSync(p: string, enc: 'utf8'): string;
  readdirSync(p: string): string[];
}

export interface WorktreeInfo {
  worktreePath: string;
  gitCommonDir: string;
  isMultiWorktree: boolean;
}

export function parseGitFile(contents: string): string | null {
  const m = contents.match(/^gitdir:\s*(.+?)\s*$/m);
  return m ? m[1] : null;
}

function findGitEntry(startDir: string, fs: FsLike): { dir: string; gitPath: string } | null {
  let dir = startDir;
  while (true) {
    const gitPath = path.join(dir, '.git');
    if (fs.existsSync(gitPath)) return { dir, gitPath };
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function detectWorktree(folderPath: string, fs: FsLike): WorktreeInfo | null {
  const found = findGitEntry(folderPath, fs);
  if (!found) return null;
  const { dir: worktreePath, gitPath } = found;

  let gitCommonDir: string;
  const st = fs.statSync(gitPath);
  if (st.isDirectory()) {
    gitCommonDir = gitPath;
  } else {
    const gitdir = parseGitFile(fs.readFileSync(gitPath, 'utf8'));
    if (!gitdir) return null;
    // .../worktrees/<id>  ->  strip last two segments
    gitCommonDir = path.dirname(path.dirname(gitdir));
  }

  const worktreesDir = path.join(gitCommonDir, 'worktrees');
  const entries = fs.existsSync(worktreesDir) ? fs.readdirSync(worktreesDir) : [];
  return { worktreePath, gitCommonDir, isMultiWorktree: entries.length > 0 };
}
