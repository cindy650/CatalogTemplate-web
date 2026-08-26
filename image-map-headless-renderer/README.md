# Image Map Headless Renderer

这是从 `CatalogTemplate-web/src/image-map-editor` 摘出的最小绘图模块。它不包含
React、Ant Design、编辑交互、属性面板、接口请求和状态管理，只负责：

1. 接收 image-map-editor 导出的完整 Fabric JSON；
2. 在无头 Chromium 中用 Fabric `7.4.0` 还原图层；
3. 按 `id === "workarea"` 裁切画布；
4. 导出 JPG 和 PNG。

现有项目源码没有被修改，本目录可整体复制到其他服务。

## Node.js

```powershell
cd image-map-headless-renderer
npm install
node ./node/render.mjs D:\data\layout.json
```

未指定格式时，会在 JSON 所在目录同时生成 `layout.jpg` 和 `layout.png`。

```powershell
node ./node/render.mjs D:\data\layout.json `
  --jpg D:\output\preview.jpg `
  --png D:\output\preview.png `
  --dpi 300
```

也可以作为模块调用：

```js
import { renderImageMapJson } from './image-map-headless-renderer/node/index.mjs';

const result = await renderImageMapJson({
  json: layoutObject,
  jpgPath: 'D:/output/preview.jpg',
  pngPath: 'D:/output/preview.png',
  dpi: 300,
});
```

Node 启动器优先使用显式指定的浏览器或系统 Edge/Chrome，再回退到 Playwright
安装的 Chromium。也可以用 `browserExecutable` 或 CLI 的 `--browser` 指定路径。

## Python

浏览器里的绘图代码仍然是同一个原生 JS，Python 只负责启动无头浏览器和写文件：

```powershell
cd image-map-headless-renderer
pip install -r python/requirements.txt
python python/render.py D:\data\layout.json --dpi 300
```

## 浏览器原生 API

`browser/runner.html` 加载后会提供：

```js
const result = await globalThis.ImageMapHeadlessRenderer.render({
  json: layoutObject,
  formats: ['jpg', 'png'],
  dpi: 300,
  quality: 0.95,
});

result.images.jpg; // data:image/jpeg;base64,...
result.images.png; // data:image/png;base64,...
```

因此 Node Playwright、Python Playwright、Selenium 或其他无头浏览器都可以直接
调用这一个 JS API。

## 输入契约

支持三种结构：

```js
[{ id: 'workarea' }, ...]
{ objects: [{ id: 'workarea' }, ...] }
{ layers: { objects: [{ id: 'workarea' }, ...] } }
```

- 必须包含 `id === "workarea"`。
- 内容对象保持编辑器导出的原始 Fabric 场景坐标，不使用 `workarea-local`。
- 对象中的 `fontUrl` 会先通过浏览器 `FontFace` 加载。
- Node/Python 启动器会把本地或远程图片和字体转为 data URL，避免 OSS CORS 影响无头绘图。
- 支持 Fabric 标准对象及编辑器的 SVG、Arrow、Cube、wordSpacing。
- `Textbox` 在渲染时使用自然文字宽度，只有 JSON 文本中的显式换行符才会换行；不会因文本框宽度自动换行。
- Chart、Element、Iframe、Video 是编辑器 DOM 覆盖层，本来就不是 Fabric 静态像素，导出时忽略并返回 warning。

## 尺寸

逻辑与当前编辑器 `saveCanvasImage` 保持一致：编辑坐标按 96 CSS px/in，工作区
裁切尺寸先向上取整，默认导出倍率为 `300 / 96`。输入 JSON 不会被修改。
