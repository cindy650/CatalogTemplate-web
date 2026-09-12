# 面包屑天气组件调研

## 结论

目前没有一个“直接装上就适合本项目窄面包屑”的成熟 React 天气组件。大多数现成包要么自带完整天气卡片布局，要么绑定需要 API key 的天气供应商。推荐分两层实现：

1. 数据层使用 Open-Meteo Forecast API；由 `current` 返回温度、体感温度、昼夜标记、WMO `weather_code`、云量和风速。
2. 展示层先复用项目已有的 `@ant-design/icons`（`SunOutlined`、`CloudOutlined`、`ThunderboltOutlined` 等），做一个约 200-280px 的 `WeatherBreadcrumb`。天气图标、城市、温度和状态文字放在玻璃 Header 的前景层，动态云/雨背景放在整条 Header 的背景层。

这样不会引入第二套图标库，也能和现有 Ant Design、Apple 风格、窄屏折叠导航保持一致。若后续需要更丰富的真实 SVG 动画，再按需复制 `@bybas/weather-icons` 的单个 SVG，而不是把完整图标包加入首屏依赖。

## 方案比较

| 方案 | 图标/动态能力 | 依赖与体积 | 密钥/许可 | 对面包屑的适配判断 |
| --- | --- | --- | --- | --- |
| **自建轻量组件 + Open-Meteo + Ant Icons（推荐）** | WMO code 映射到现有 Ant 图标；背景动画用 CSS，完全可控 | 不新增包；仅 `fetch` 和现有图标 | Open-Meteo 免费接口无需 key，但仅限非商业；数据 CC BY 4.0，需要署名 | 最适合窄条、玻璃背景和现有设计系统 |
| `@bybas/weather-icons` / Meteocons | 475+ 手绘图标，提供 animated SVG、static SVG 和 Lottie | npm `2.0.0` unpacked 约 2.45 MB、808 文件；可只取单个 SVG | MIT；动画 SVG 需按无障碍和 reduced-motion 处理 | 视觉质量最高，但全量包偏大，建议按需引入 |
| `react-open-weather` | React 天气卡片；UI 与 provider 解耦，内置 OpenWeather、WeatherBit、Visual Crossing hooks；使用 SVG 图标，可自定义主题 | npm `1.3.9` unpacked 约 309 KB；依赖 Emotion、Axios、Day.js、prop-types | MIT；三个 provider 都要求注册并提供 API key | 更像独立天气卡片，布局和依赖对 Header 过重 |
| `weather-icons-react` | React SVG 图标，静态图标为主 | npm `1.2.0` 约 386 KB，项目较旧 | MIT；图标来源 weathericons.io，字体/图标许可需单独核对 | 可用但无内建动画，维护活跃度和 TS 体验较弱 |
| `react-icons-weather` | 基于 OpenWeather/Yahoo/DarkSky code 的 React 图标字体 | npm `1.0.5` 约 839 KB；2018 年发布 | MIT；依赖字体资源，需确认字体许可 | 不推荐，体积和旧技术栈都不适合当前项目 |

上述包版本、体积和许可来自 npm registry；体积为 registry 的 `dist.unpackedSize`，不是最终 Vite gzip 体积，落地前应以生产构建分析为准。

## 数据源

### Open-Meteo（推荐起步）

- 官方 README 说明：开源、非商业用途免费、无需 API key、支持 CORS，无广告和跟踪；Forecast 最长 16 天。
- `current` 可请求 `temperature_2m`、`apparent_temperature`、`is_day`、`weather_code`、`cloud_cover`、`wind_speed_10m`。返回的 `current.interval` 通常为 900 秒，可按 15 分钟刷新。
- WMO code 映射由官方文档给出：`0` 晴；`1/2/3` 晴间多云/局部多云/阴；`45/48` 雾；`51-57` 毛毛雨；`61-67` 雨/冻雨；`71-77` 雪；`80-82` 阵雨；`85/86` 阵雪；`95/96/99` 雷暴/冰雹。
- 免费服务条款限制为每天少于 10,000、每小时 5,000、每分钟 600 次；免费 API 只允许非商业用途，数据按 CC BY 4.0 使用并需要署名。商业产品应使用其付费计划或改用有商业许可的供应商。

示例请求：

```text
https://api.open-meteo.com/v1/forecast?latitude=34.2138&longitude=108.9488&current=temperature_2m,apparent_temperature,is_day,weather_code,cloud_cover,wind_speed_10m&timezone=Asia%2FShanghai
```

城市名可用 Open-Meteo Geocoding API 预先解析，然后缓存经纬度；不要在每次路由切换时重复地理编码。

### WeatherAPI（商业备选）

WeatherAPI 官方文档的实时接口为 `/v1/current.json`，认证通过必填的 `key` 查询参数；响应包含 condition 文本和 icon URL，并支持 forecast、alerts 等扩展。官方定价页列出免费计划和商业用途选项，免费计划建议提供指向 WeatherAPI 的链接。若项目需要商业许可、供应商 SLA 或直接使用其现成图标，可在服务端代理该 API，避免把 key 放在浏览器代码中。

## 位置与隐私

不建议首次打开页面就强制请求定位权限。浏览器 Geolocation `getCurrentPosition()` 只在 HTTPS 安全上下文可用，并需要用户显式授权。建议顺序：

1. 使用账号/店铺已配置的城市或服务端默认坐标。
2. 提供“使用当前位置”按钮，用户主动点击后再调用浏览器定位。
3. 定位拒绝或失败时回退到默认城市，仍展示天气状态，不阻塞导航。

公共 Nominatim 服务限制最多 1 req/s，要求 User-Agent/Referer、显示 OSM attribution、缓存结果，并禁止客户端 autocomplete/系统性查询，因此不适合作为面包屑每次加载的地理编码服务。

## 面包屑落地规范

### 信息层级

- 默认只显示：天气图标、城市名、整数温度（当前默认地点为 `西安雁塔区`）。
- 详细信息放入点击/键盘可操作的 Popover：状态文字、体感温度、风速、更新时间和数据来源。
- 加 `aria-label="西安雁塔区，晴，25 摄氏度，天气更新时间……”`；更新区域使用 `aria-live="polite"`，不要依赖颜色传达晴/雨状态。
- Loading、错误和过期数据必须有文字状态；保留最近一次成功结果并标注“数据可能已过期”。

### 动态背景

- 背景层覆盖整个 Header，内容层使用现有玻璃材质和对比度保护；天气效果不可改变导航文字位置。
- 首期只做低频、低对比度动画：晴天光晕、云层水平缓移、雨/雪细线。避免持续高频粒子和大幅闪烁。
- `@media (prefers-reduced-motion: reduce)` 下停止动画，仅保留静态背景和文字状态。
- 玻璃层应保留足够不透明度/遮罩，确保正文与图标达到 WCAG AA 对比度；动态背景不是信息的唯一载体。

### 请求与缓存

- 按城市坐标缓存 15 分钟，使用 `AbortController` 设置约 5 秒超时；路由切换不应重复请求。
- 网络失败时显示缓存数据和“上次更新”时间；没有缓存时显示中性占位，不显示虚假的温度。
- 可以在 Popover 中提供手动刷新按钮；不要让 Header 每次渲染都触发请求。

## 官方来源

- [Open-Meteo README](https://github.com/open-meteo/open-meteo)（API 能力、无 key、CORS、非商业免费、CC BY 4.0）
- [Open-Meteo Forecast API 文档](https://open-meteo.com/en/docs)（current 参数与 WMO weather code 表）
- [Open-Meteo Terms](https://open-meteo.com/en/terms)（调用上限、非商业限制和署名要求）
- [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api)
- [WeatherAPI 官方文档](https://www.weatherapi.com/docs/)（API key、current/forecast、condition icon）
- [WeatherAPI 官方定价](https://www.weatherapi.com/pricing.aspx)（免费计划、调用量、商业用途与链接回指）
- [MDN Geolocation.getCurrentPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition)（HTTPS 与用户授权要求）
- [Nominatim 使用政策](https://operations.osmfoundation.org/policies/nominatim/)（频率、缓存、署名和客户端查询限制）
- [Ant Design Card](https://ant.design/components/card)（现有组件库的 hoverable/语义 DOM 参考）
- [Ant Design Badge](https://ant.design/components/badge)（通知入口和状态点参考）
- [@bybas/weather-icons npm metadata](https://registry.npmjs.org/@bybas/weather-icons) 与 [Meteocons 源码](https://github.com/basmilius/weather-icons)（动画 SVG、MIT、包体信息）
- [react-open-weather npm metadata](https://registry.npmjs.org/react-open-weather) 与 [官方 README](https://github.com/farahat80/react-open-weather)（provider、API key、SVG、MIT）
- [weather-icons-react 源码](https://github.com/najens/weather-icons-react)
- [react-icons-weather npm metadata](https://registry.npmjs.org/react-icons-weather) 与 [源码](https://github.com/williamsb/react-weather-icons)

调研日期：2026-09-05
