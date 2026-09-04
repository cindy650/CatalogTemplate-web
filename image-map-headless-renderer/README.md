# Image Map Headless Renderer

这是从 `CatalogTemplate-web/src/image-map-editor` 摘出的最小绘图模块。它不包含
React、Ant Design、编辑交互、属性面板、接口请求和状态管理，只负责：

1. 接收 image-map-editor 导出的完整 Fabric JSON；
2. 在无头 Chromium 中用 Fabric `7.4.0` 还原图层；
3. 按 `id === "workarea"` 裁切画布；
4. JPG/PNG 位图导出不绘制打印辅助线；
5. 导出 JPG、PNG、可编辑 SVG 和转曲 SVG。

运行时不依赖 React 或现有页面；`browser/editor-svg-export.js` 是从编辑器当前 SVG 导出源码生成的独立 bundle，本目录可整体复制到其他服务。

## Python

浏览器里的绘图代码仍然是同一个原生 JS，Python 只负责启动无头浏览器和写文件：

```powershell
cd image-map-headless-renderer
pip install -r python/requirements.txt
python python/render.py D:\data\layout.json --dpi 300
```

未指定输出参数时，会在 JSON 所在目录生成同名的 `.jpg`、`.png`、`.svg` 和 `.text-to-svg.svg`。

```powershell
python python/render.py D:\data\layout.json `
  --jpg D:\output\preview.jpg `
  --png D:\output\preview.png `
  --svg D:\output\preview.svg `
  --text-to-svg D:\output\preview-converted.svg `
  --output-json D:\output\layout-fitted.json `
  --dpi 300
```

## 浏览器原生 API

`browser/runner.html` 加载后会提供：

```js
const result = await globalThis.ImageMapHeadlessRenderer.render({
  json: layoutObject,
  formats: ['jpg', 'png', 'svg', 'text-to-svg'],
  dpi: 300,
  quality: 0.95,
});

result.images.jpg; // data:image/jpeg;base64,...
result.images.png; // data:image/png;base64,...
result.images.svg; // XML string
result.images.textToSvg; // XML string，文字已转为路径
result.json; // 克隆后的完整 JSON，包含安全区检查后的最终 fontSize
```

产品安全距离可以作为渲染参数传入，不会写回返回的 JSON：

```js
await globalThis.ImageMapHeadlessRenderer.render({
  json: layoutObject,
  safeDistances: {
    coverSafeDistance: { top: 6, right: 6, bottom: 6, left: 6 },
    spineSafeDistance: { top: 3, right: 3, bottom: 3, left: 3 },
    backCoverSafeDistance: { top: 6, right: 6, bottom: 6, left: 6 },
  },
});
```

也支持接口响应中的同名 camelCase 字段、snake_case 字段（包括
`*_safe_distance_json`），以及 JSON 顶层或 `safeDistances` 对象中的这些字段。
优先级为 `render({ safeDistances })`，其次是 JSON 顶层，再其次是 `workarea`。

Python Playwright、Selenium 或其他无头浏览器都可以直接调用这一个 JS API。

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
- Python 启动器会把本地或远程图片转为 data URL；字体保留原始 `fontUrl`，并在内部增加 `fontDataUrl` 供无头加载和转曲使用。
- 支持 Fabric 标准对象及编辑器的 SVG、Arrow、Cube、wordSpacing。
- `Textbox` 在渲染时使用自然文字宽度，只有 JSON 文本中的显式换行符才会换行；不会因文本框宽度自动换行。
- Chart、Element、Iframe、Video 是编辑器 DOM 覆盖层，本来就不是 Fabric 静态像素，导出时忽略并返回 warning。
- JPG/PNG 位图导出不会绘制 `workarea.printGuides` 中的任何打印辅助线。SVG 导出仍保留全部打印线。
- `svg` 使用编辑器当前完整的可编辑 SVG 导出逻辑；`text-to-svg` 使用编辑器当前的 `text-to-svg` 路径转换逻辑。两者都包含工作区裁剪、背景、图层名称、打印线、CorelDRAW XML 头和格式化缩进。
- `workarea.canvasRows === 2` 时使用双排画布：总高度为两倍单排高度加 `canvasRowGap` 分隔缝，未提供该字段时默认无分隔缝（`0px`）；双排是封面/封底两面结构，不包含背脊或背脊出血，宽度为两面单面宽加左右出血；竖向辅助线贯穿整个工作区，每排分别生成横向辅助线。仍只渲染一套内容图层，不会复制图层。
- 双排 JSON 会按 `unit`、`sideWidth`、`sideHeight` 和出血字段重新核准工作区几何及辅助线，并将 `spineWidth/spineBleed` 归零。旧 JSON 未提供 `canvasRows` 时继续按单排原样渲染。
- 内容图层带有 `horizontalCentered: true` 或 `verticalCentered: true` 时，渲染器会在产图前修改克隆 JSON 中的位置：水平按对象所在的封面、背脊或封底内容区居中，垂直按对象所在的画布排内容区居中。调用方传入的原始 JSON 不会被修改，四种导出格式使用同一份归位结果。
- 文字图层导出前会检查其真实边界是否超出所属区域的安全范围。封面、背脊、封底分别使用产品接口传入的四边安全距离；这些数值固定以毫米表示，渲染时换算为 CSS 像素，不再使用固定的 `0.4in`、`0.05in` 或 `6mm`。双排画布只对封面/封底两面使用对应安全距离，不创建或检查背脊区域。带水平/垂直居中标识的文字会在缩放前先居中，字号每次固定减小 `0.5px` 并重新测量；文字合规后再按标识居中一次，确认最终位置后才生成文件。字号缩到 `1` 后仍越界则中止导出。最终字号和位置会写入返回的 `result.json`，调整结果也会在 `warnings` 中报告图层名称和调整前后的字号。Python 启动器可通过 `--output-json` 写出该结果，不会覆盖原始输入文件。
- 当 `workarea.separateBleed === true` 时，宽度和竖向辅助线使用 `horizontalBleed`，高度和横向辅助线使用 `verticalBleed`；否则继续使用原来的统一 `bleed`。

## 尺寸

逻辑与当前编辑器 `saveCanvasImage` 保持一致：编辑坐标按 96 CSS px/in，工作区
裁切尺寸先向上取整，默认导出倍率为 `300 / 96`。输入 JSON 不会被修改。
