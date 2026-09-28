# 项目交接文档

## 1. 应用入口与全局编排

- `src/main.tsx`：React 应用入口。
- `src/App.tsx`：全局状态、接口初始化、店铺/产品/订单上下文管理。
- `src/layout`：整体布局、菜单、面包屑和全局界面。

## 2. 路由与模块渲染

- `src/router/useAppRoute.ts`：基于 hash 的模块路由。
- `src/modules/moduleRegistry.tsx`：模块注册、菜单和上下文定义。
- `src/modules/moduleRenderer.tsx`：根据当前模块渲染页面。

## 3. 业务模块

- `shops`：店铺概览，进入订单和尺寸模板。
- `orders`：订单列表、筛选分页、订单模板编辑、打印和导出。
- `templates`：模板库、产品关联、模板选择。
- `sizeTemplates`：尺寸模板和 Fabric 画布编辑。
- `innerPages`：内页模板管理。
- `fonts`：字体资源管理。
- `fontLayouts`：字体布局模板管理。
- `textGenerationRules`：文字生成规则配置。
- `exports`：导出历史查看。
- `account`：账户信息。
- `imageMapEditorTest`：图片地图编辑器测试宿主。
- `uiPrototype`：界面原型验证。

## 4. 图片地图编辑器

- `src/image-map-editor/canvas`：Fabric 画布、对象、事件处理、缩放、对齐和导出。
- `src/image-map-editor/editors/imagemap`：图片地图编辑器页面、属性面板、数据源、动画、预览和工具栏。
- `components`、`theme`、`i18n`：通用组件、主题和多语言支持。

## 5. 接口与基础服务

- `src/api.ts`、`src/api/httpClient.ts`：后端接口封装、数据标准化及本地存储兼容。
- `src/services`：订单事件流、通知路由和声音提醒。
- `src/shared`：领域模型、事件定义和安全距离计算。

## 6. 无头渲染与辅助目录

- `image-map-headless-renderer`：根据编辑器 JSON 渲染 PNG/JPG/SVG，并复用文字转曲和图片导出逻辑。
- `scripts`：编辑器和数据规则校验脚本。
- `docs`：项目说明和编辑器文档。
- `design-system`：页面设计研究和规范资料。
- `public`：静态资源。

## 7. 模块关联

主链路：

`App → API/全局状态 → 路由 → moduleRenderer → 业务页面`

店铺和产品上下文会影响模板、内页、字体布局及尺寸模板；模板库选择模板后可跳转尺寸模板编辑器；订单可进入模板编辑器，保存后回写订单；订单事件流通过通知服务刷新订单并触发提醒。

