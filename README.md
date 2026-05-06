# DIY EXIF Frame

本地照片 EXIF 边框生成器。照片只在浏览器本地处理，不需要上传到服务器。

## Run

```bash
npm install
npm run dev
```

打开 `http://localhost:5173/`。

## Deploy

项目已部署到 GitHub Pages：

https://henry-insomniac.github.io/diy-exif/

当前 Pages 来源是 `gh-pages` 分支根目录。部署前先构建：

```bash
npm ci
npm run build
```

然后把 `dist/` 内容发布到 `gh-pages` 分支。

## 大图处理策略

- 不使用 Base64，避免 60MB 照片被额外放大。
- EXIF 解析、解码、缩放和 Canvas 合成都在 Web Worker 中执行。
- 预览默认降采样到长边 1800px。
- 导出支持长边 3000px、5000px 和 Source 原图模式。
- Source 模式会受浏览器 Canvas 像素上限保护，超大图会自动收敛尺寸并给出提示。
