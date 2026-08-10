# 相册排版管理 Web

这是从 Electron 桌面端剥离出来的独立 React + TypeScript + Fabric.js 网页项目。它可以单独复制、单独安装依赖、单独启动和部署，不依赖外层项目的 `packages/shared`、Electron、preload、SQLite 或 Google Sheet 同步代码。

## 启动

在当前独立项目目录执行：

```bash
npm install
npm run dev
```

默认地址为 `http://localhost:3000`。

## 接口配置

开发环境接口根地址配置在 `.env.development`：

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

具体接口路径和响应字段暂不预设，收到后端接口定义后在 `src/api.ts` 中接入。生产环境地址保留在 `.env.production`，待正式服务确定后填写。

模板、模板版本、导出历史和账号资料当前保存在浏览器 `localStorage`，后续接入对应后端接口时只需替换 `src/api.ts`。

## 构建

```bash
npm run typecheck
npm run build
```

生产产物输出到 `dist`。
