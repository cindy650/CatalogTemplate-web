import { useEffect, useMemo, useState, type ComponentType } from 'react';
import { BgColorsOutlined, CloudOutlined, LoadingOutlined, SunOutlined, ThunderboltOutlined, WarningOutlined } from '@ant-design/icons';
import { Button, Popover, Space, Typography } from 'antd';
import Droplets from './Droplets';

export type WeatherTone = 'clear' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'night' | 'neutral';

type WeatherIconProps = { className?: string };

function RainCloudIcon({ className }: WeatherIconProps) {
  return (
    <span className={`${className ?? ''} weather-rain-icon`.trim()} aria-hidden="true">
      <CloudOutlined className="weather-rain-icon-cloud" />
      <span className="weather-rain-icon-drops">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}

type WeatherPresentation = {
  label: string;
  tone: WeatherTone;
  Icon: ComponentType<WeatherIconProps>;
};

type CurrentWeather = {
  temperature: number;
  apparentTemperature?: number;
  weatherCode: number;
  cloudCover?: number;
  windSpeed?: number;
  isDay: boolean;
  observedAt?: string;
};

type OpenMeteoResponse = {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    weather_code?: number;
    cloud_cover?: number;
    wind_speed_10m?: number;
    is_day?: number;
    time?: string;
  };
};

type CachedWeather = {
  weather: CurrentWeather;
  cachedAt: number;
};

const weatherLocationLabel = '西安雁塔区';
const weatherEndpoint = 'https://api.open-meteo.com/v1/forecast?latitude=34.2138&longitude=108.9488&current=temperature_2m,apparent_temperature,is_day,weather_code,cloud_cover,wind_speed_10m&timezone=Asia%2FShanghai';
const weatherCacheKey = 'catalog-template.weather.xian-yanta';
const weatherCacheTtl = 15 * 60 * 1000;
let memoryCache: CachedWeather | undefined;

function readCachedWeather(): CachedWeather | undefined {
  if (memoryCache && Date.now() - memoryCache.cachedAt < weatherCacheTtl) return memoryCache;
  try {
    const raw = window.sessionStorage.getItem(weatherCacheKey);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as CachedWeather;
    if (!parsed?.weather || Date.now() - parsed.cachedAt >= weatherCacheTtl) return undefined;
    memoryCache = parsed;
    return parsed;
  } catch {
    return undefined;
  }
}

function writeCachedWeather(weather: CurrentWeather): CachedWeather {
  const cached = { weather, cachedAt: Date.now() };
  memoryCache = cached;
  try {
    window.sessionStorage.setItem(weatherCacheKey, JSON.stringify(cached));
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
  return cached;
}

function presentationForWeather(weatherCode: number, isDay: boolean): WeatherPresentation {
  if (!isDay && weatherCode <= 3) return { label: '夜间', tone: 'night', Icon: CloudOutlined };
  if (weatherCode === 0) return { label: '晴', tone: 'clear', Icon: SunOutlined };
  if (weatherCode <= 3) return { label: '多云', tone: 'cloudy', Icon: CloudOutlined };
  if (weatherCode === 45 || weatherCode === 48) return { label: '雾', tone: 'cloudy', Icon: CloudOutlined };
  if (weatherCode >= 95) return { label: '雷雨', tone: 'storm', Icon: ThunderboltOutlined };
  if (weatherCode >= 71 && weatherCode <= 86) return { label: '雨夹雪/降雪', tone: 'snow', Icon: BgColorsOutlined };
  if (weatherCode >= 51 && weatherCode <= 67 || weatherCode >= 80 && weatherCode <= 82) return { label: '降雨', tone: 'rain', Icon: RainCloudIcon };
  return { label: '天气变化', tone: 'neutral', Icon: CloudOutlined };
}

function formatObservedAt(value?: string): string {
  if (!value) return '刚刚';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function normalizeWeather(response: OpenMeteoResponse): CurrentWeather {
  const current = response.current;
  if (!current || typeof current.temperature_2m !== 'number' || typeof current.weather_code !== 'number') {
    throw new Error('天气数据格式不完整');
  }
  return {
    temperature: current.temperature_2m,
    apparentTemperature: typeof current.apparent_temperature === 'number' ? current.apparent_temperature : undefined,
    weatherCode: current.weather_code,
    cloudCover: typeof current.cloud_cover === 'number' ? current.cloud_cover : undefined,
    windSpeed: typeof current.wind_speed_10m === 'number' ? current.wind_speed_10m : undefined,
    isDay: current.is_day !== 0,
    observedAt: current.time
  };
}

async function fetchWeather(signal: AbortSignal): Promise<CurrentWeather> {
  const response = await fetch(weatherEndpoint, { signal });
  if (!response.ok) throw new Error(`天气请求失败（${response.status}）`);
  return normalizeWeather(await response.json() as OpenMeteoResponse);
}

export default function WeatherBreadcrumb({ onToneChange }: { onToneChange?(tone: WeatherTone): void }) {
  const [weather, setWeather] = useState<CurrentWeather>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const presentation = useMemo(
    () => weather ? presentationForWeather(weather.weatherCode, weather.isDay) : undefined,
    [weather]
  );

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | undefined;

    const load = async () => {
      const cached = readCachedWeather();
      if (cached) {
        setWeather(cached.weather);
        setLoading(false);
        setError(false);
        return;
      }
      controller?.abort();
      controller = new AbortController();
      const timeout = window.setTimeout(() => controller?.abort(), 5000);
      try {
        const next = await fetchWeather(controller.signal);
        if (disposed) return;
        writeCachedWeather(next);
        setWeather(next);
        setError(false);
      } catch {
        if (!disposed) setError(true);
      } finally {
        window.clearTimeout(timeout);
        if (!disposed) setLoading(false);
      }
    };

    void load();
    const refreshTimer = window.setInterval(() => { void load(); }, weatherCacheTtl);
    return () => {
      disposed = true;
      controller?.abort();
      window.clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    onToneChange?.(presentation?.tone ?? 'neutral');
  }, [onToneChange, presentation?.tone]);

  if (loading && !weather) {
    return (
      <div className="weather-breadcrumb weather-breadcrumb-loading" aria-label="天气加载中" aria-live="polite">
        <LoadingOutlined spin />
        <span>天气</span>
      </div>
    );
  }

  if (!weather || !presentation) {
    return (
      <Popover content="天气暂不可用，导航功能不受影响。" trigger="click">
        <Button type="text" className="weather-breadcrumb weather-breadcrumb-unavailable" aria-label="天气暂不可用">
          <WarningOutlined />
          <span>天气暂不可用</span>
        </Button>
      </Popover>
    );
  }

  const Icon = presentation.Icon;
  const staleLabel = error ? ' · 数据可能已过期' : '';
  const weatherLabel = `当前天气：${weatherLocationLabel}，${presentation.label}，${Math.round(weather.temperature)}摄氏度${staleLabel}`;
  const weatherClassName = `weather-breadcrumb weather-tone-${presentation.tone}`;
  const detail = (
    <div className="weather-breadcrumb-popover">
      <Typography.Text strong>{weatherLocationLabel} · {presentation.label}</Typography.Text>
      <span>体感 {weather.apparentTemperature === undefined ? '-' : `${Math.round(weather.apparentTemperature)}°C`}</span>
      <span>云量 {weather.cloudCover === undefined ? '-' : `${Math.round(weather.cloudCover)}%`}</span>
      <span>风速 {weather.windSpeed === undefined ? '-' : `${Math.round(weather.windSpeed)} km/h`}</span>
      <Typography.Text type="secondary">更新于 {formatObservedAt(weather.observedAt)}{error ? ' · 数据可能已过期' : ''}</Typography.Text>
    </div>
  );

  return (
    <Popover content={detail} trigger="click" placement="bottomLeft">
      <Button type="text" className={weatherClassName} aria-label={weatherLabel}>
        {(presentation.tone === 'rain' || presentation.tone === 'storm') ? (
          <>
            <Droplets
              className="weather-droplets"
              style={{ position: 'absolute', inset: 0 }}
              intensity={0.5}
              speed={1}
              scale={0.19}
              dropWidth={1.32}
              dropLength={1.24}
              refraction={0.34}
              blur={0}
              vignette={0}
              fallSpeed={1}
              wiggle={1}
              staticDrops={0.2}
              interactionRadius={0.3}
              interactionStrength={0.6}
              interactionDistortion={3}
              tintStrength={0.9}
              tint={[0.96, 0.99, 1]}
            />
            <span className="weather-droplets-content">
              <Icon className="weather-breadcrumb-icon" />
              <Space size={5} className="weather-breadcrumb-copy">
                <span className="weather-breadcrumb-location">{weatherLocationLabel}</span>
                <strong>{Math.round(weather.temperature)}°C</strong>
                <span className="weather-breadcrumb-description">{presentation.label}</span>
              </Space>
            </span>
          </>
        ) : (
          <>
            <Icon className="weather-breadcrumb-icon" />
            <Space size={5} className="weather-breadcrumb-copy">
              <span className="weather-breadcrumb-location">{weatherLocationLabel}</span>
              <strong>{Math.round(weather.temperature)}°C</strong>
              <span className="weather-breadcrumb-description">{presentation.label}</span>
            </Space>
          </>
        )}
      </Button>
    </Popover>
  );
}
