# 拾日网页版

与大肥鱼一起安排日程、远方计划与专注时光。

这是拾日网页版 1.0.0 的静态发布目录，打开已部署的 HTTPS 网站即可使用，无需安装依赖或构建。

## 数据与离线

任务数据保存在各自设备的浏览器中，访问同一网址不会自动同步。请通过应用设置定期导出备份。

首次打开请保持联网，等待“离线就绪”。在 iPad Safari 中点“分享 → 添加到主屏幕”即可安装使用。

## GitHub Pages

在仓库 Settings → Pages 中选择 Deploy from a branch、main 和 / (root)，保存。部署状态与正式网址以 GitHub Pages 返回的结果为准。

## 文件

index.html、styles.css、app.mjs、core.mjs、sw.js、manifest.webmanifest 与 assets/ 是网站内容。.nojekyll 用于静态发布。

## 更新

替换文件时同步提高 sw.js 的缓存版本号，以便现有安装接收新资源。iPad Safari 尚待真机验收。
