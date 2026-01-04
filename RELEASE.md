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