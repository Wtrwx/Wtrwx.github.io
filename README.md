# 维他入我心 · Hugo + Archie

使用 Hugo 0.166.0、Archie 明暗主题切换、中文导航、本地搜索、标签和 RSS。主题默认跟随系统外观，手动切换后会记住选择。

## 本地预览

安装 Hugo 0.166.0，然后运行 `hugo server -D`，访问 http://localhost:1313/。
运行 `hugo --minify` 构建静态站点，产物位于 `public/`。

## 写文章

运行 `hugo new content posts/my-post.md`，编辑正文与元数据；发布前设置 `draft: false`。
旧文章使用 `url` 保持原始地址，新文章默认发布到 `/posts/my-post/`。

## 迁移

见 [迁移清单](migration/REPORT.md)。旧站可通过 Git 提交 `5a99b1ef` 恢复。
主题直接纳入仓库，来源版本见 `themes/archie/UPSTREAM.txt`，保留原 MIT 许可证。

## 部署

合并到 master 后，Actions 使用官方 Pages action 部署构建产物。
正式切换时，将 GitHub Pages 的发布源从分支发布改为 GitHub Actions。
PR 只构建与上传预览产物，不部署；不重写旧 master 历史。
若需回滚，将 Pages 发布源切回包含旧静态站点的分支即可。

订阅入口 `/atom.xml` 保留，保持 Atom 格式。
