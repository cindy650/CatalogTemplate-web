# Weather In Breadcrumb Research

Updated: 2026-09-05

## Recommended integration

The current app already ships `antd` and `@ant-design/icons`. For a compact breadcrumb weather strip, map Open-Meteo WMO weather codes to existing icons (`SunOutlined`, `CloudOutlined`, `ThunderboltOutlined`, `BgColorsOutlined`) and animate only the background layer with CSS. This avoids a second icon system and keeps the bundle small.

Use a small adapter with this shape:

```ts
type BreadcrumbWeather = {
  location: string;
  temperatureC: number;
  apparentTemperatureC?: number;
  weatherCode: number;
  isDay: boolean;
  observedAt: string;
};
```

Render only location, temperature, and the weather icon in the header. Keep the full forecast in a popover or dedicated page so the breadcrumb remains a navigation surface.

## Data sources

### Open-Meteo

- Docs: https://open-meteo.com/en/docs
- Terms: https://open-meteo.com/en/terms
- Source/readme: https://github.com/open-meteo/open-meteo
- Current weather request example (the app default is Xi'an Yanta District):
  `https://api.open-meteo.com/v1/forecast?latitude=34.2138&longitude=108.9488&current=temperature_2m,apparent_temperature,is_day,weather_code,cloud_cover,wind_speed_10m&timezone=Asia%2FShanghai`
- No API key and CORS are supported. Forecasts expose up to 16 days and current variables include temperature, apparent temperature, day/night, precipitation, cloud cover, wind, and WMO weather code.
- The free API is explicitly for non-commercial use, with CC BY 4.0 attribution. Terms list limits of fewer than 10,000 calls/day, 5,000/hour, and 600/minute. Commercial deployment should use a paid plan or a different provider.
- The WMO table in the docs maps codes as follows: `0` clear; `1-3` clear/partly cloudy/overcast; `45,48` fog; `51-57` drizzle/freezing drizzle; `61-67` rain/freezing rain; `71-77` snow; `80-82` rain showers; `85-86` snow showers; `95` thunderstorm; `96,99` thunderstorm with hail.

### Location lookup

- Open-Meteo geocoding: https://open-meteo.com/en/docs/geocoding-api
- Example: `https://geocoding-api.open-meteo.com/v1/search?name=Shanghai&count=1&language=zh&format=json`
- Prefer a configured store city or a single cached lookup. Do not geocode on every route change.
- Browser geolocation reference: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition. It requires HTTPS, explicit user permission, and can be blocked by Permissions Policy. Treat location as optional and fall back to a configured city.

### Commercial alternative

- WeatherAPI docs: https://www.weatherapi.com/docs/
- It supports current and 1-14 day forecast endpoints but requires an API key. Keep the key behind a server proxy and cache the result rather than embedding it in the browser.

## Icon packages

### Prefer existing Ant icons

No extra dependency. Ant Design icons are already present and match the rest of the app. Add CSS motion to the full-width breadcrumb background (`cloud drift`, `rain shimmer`) and disable it under `prefers-reduced-motion: reduce`.

### `@bybas/weather-icons`

- npm: https://registry.npmjs.org/@bybas/weather-icons
- Source: https://github.com/basmilius/meteocons
- MIT license; animated SVG weather icons. npm v2.0.0 metadata reports approximately 2.45 MB unpacked across 808 files. Use only the required SVG assets if this visual system is approved; importing the whole package is unnecessary for one breadcrumb icon.

### `weather-icons-react`

- npm: https://registry.npmjs.org/weather-icons-react
- Source/README: https://github.com/najens/weather-icons-react
- MIT wrapper around Weather Icons; approximately 386 KB unpacked. The package is old and does not provide modern animation behavior. Its README points to the upstream Weather Icons license, so retain the upstream SIL OFL notice if used.

### `weather-icons` CSS font

- Source: https://github.com/erikflowers/weather-icons
- 222 weather icons with WMO/OpenWeather mappings. Code is MIT; font is SIL OFL 1.1. It adds font/CSS assets and is less convenient than SVG for a React component.

## Breadcrumb behavior and accessibility

- Weather is supplemental context, not the navigation label. Keep the selected module title visible and stable while weather data loads.
- Show a skeleton or neutral icon during loading; show the last successful value with a stale indicator on failure; never block navigation on weather.
- Give the weather region an accessible name such as `当前天气：西安雁塔区，25°C，晴`. Do not rely on color or animation alone.
- Mark decorative moving layers `aria-hidden="true"` and respect `@media (prefers-reduced-motion: reduce)` by stopping keyframes and SVG animation.
- Refresh on a long interval (for example, 15 minutes) and on explicit user action. Cache by coordinates to avoid unnecessary requests.

## Decision

Start with Open-Meteo behind a small provider abstraction only if the deployment is non-commercial or an appropriate paid plan is selected. Use Ant Design icons plus CSS motion for the first implementation. Keep `@bybas/weather-icons` as an optional visual upgrade after bundle and licensing review.
