// Advance one shared integration branch without rewriting anyone's history.
// CI owns validation and deployment; a push alone is never a live-site claim.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('..', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
if (git('status', '--porcelain')) throw new Error('Commit or preserve local changes before publishing a preview');
if (git('branch', '--show-current') === 'main') throw new Error('Publish the implementation branch, not main');
const remote = git('remote', 'get-url', '--push', 'origin');
if (!/github\.com[:/]majieddd\/worldheart(?:\.git)?$/.test(remote)) throw new Error('Unexpected origin; verify repository before publishing');
git('fetch', 'origin');
const existing = git('ls-remote', '--heads', 'origin', 'refs/heads/preview/v2');
if (existing) {
  const previous = existing.split(/\s/)[0];
  try { git('merge-base', '--is-ancestor', previous, 'HEAD'); }
  catch { throw new Error('Preview advanced elsewhere. Integrate origin/preview/v2, verify, then publish again. Never force-push it.'); }
}
execFileSync('git', ['push', 'origin', 'HEAD:refs/heads/preview/v2'], { cwd, stdio: 'inherit' });
console.log('Preview queued. Verify the Publish V2 preview action and /worldheart/v2/build.json before reporting it live.');
