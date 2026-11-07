# Complete Action

1. Run `npm test`, `npm run build` and `npm run lint`. If any of them fails, stop and report it: nothing gets committed
2. Stage this feature's files by name, never with `git add -A` or `git add .`, then commit with a descriptive message. Leave unrelated files untracked and list them in your report
3. Switch to main and merge the feature branch (no push yet)
4. Delete the local feature branch
5. Reset current-feature.md:
   - Change H1 back to `# Current Feature`
   - Clear Goals and Notes sections (keep placeholder comments)
   - Add feature summary to the END of History
6. Commit the reset: `chore: reset current-feature.md after completing [feature]`
7. Push main to origin ONCE (single push with all changes)
8. If feature branch was previously pushed, delete it from origin
