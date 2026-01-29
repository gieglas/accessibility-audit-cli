1. first `commit` all changes
2. create new `tag` for release
3. force push main
4. force push tag

``` bash
git commit -am "Release 2.1.4"
git tag v2.1.4
# git tag -f latest
# git tag -f v2.x.x
git push origin main
git push origin --force --tags
```


# Release checklist (accessibility-audit-cli)

Before publishing a new version:

## Packaging
- [ ] Run `npm pack`
- [ ] Inspect tarball contents
  - cli/accessibility-audit.mjs present
  - analysis/* present
  - excel_analysis/aggregated_analysis/*.xlsm present
- [ ] No unexpected files included

## CLI smoke tests (Windows)
- [ ] `npx accessibility-audit audit audit-config.json`
- [ ] `npx accessibility-audit analysis init-excel`
- [ ] Verify outputs written to project root (not node_modules)

## CLI smoke tests (Linux/macOS)
- [ ] Same commands as above

## Regression checks
- [ ] Excel templates copied only to cwd
- [ ] CSV copy writes only to cwd
- [ ] No writes inside node_modules

## Versioning
- [ ] package.json version bumped
- [ ] CHANGELOG updated
