import axios, { type AxiosError, type AxiosRequestConfig } from 'axios';

const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();
const apiBaseUrl = configuredBaseUrl ? configuredBaseUrl.replace(/\/+$/, '') : undefined;
const accessTokenStorageKey = 'album-web-access-token';

type ApiErrorPayload = {
  message?: string;
  detail?: string;
  error?: string;
};

export class ApiRequestError extends Error {
  readonly status?: number;
  readonly code?: string;

  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
  }
}

function readAccessToken(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(accessTokenStorageKey) ?? '';
  } catch {
    return '';
  }
}

function responseErrorMessage(error: AxiosError<ApiErrorPayload>): string {
  const payload = error.response?.data;
  if (payload && typeof payload === 'object') {
    const message = payload.message ?? payload.detail ?? payload.error;
    if (message) return message;
  }
  if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
    return '接口请求超时，请稍后重试。';
  }
  if (!error.response) {
    return '无法连接到接口服务，请检查服务地址和网络。';
  }
  return '接口请求失败（' + error.response.status + '）：' + (error.response.statusText || '未知错误');
}

export const httpClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
  headers: {
    Accept: 'application/json'
  }
});

httpClient.interceptors.request.use(
  (config) => {
    const token = readAccessToken();
    config.headers.set('Accept', 'application/json');
    if (token) config.headers.set('Authorization', 'Bearer ' + token);
    return config;
  },
  (error) => Promise.reject(error)
);

httpClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorPayload>) => Promise.reject(
    new ApiRequestError(responseErrorMessage(error), error.response?.status, error.code)
  )
);

export function apiRequest<T>(config: AxiosRequestConfig): Promise<T> {
  if (import.meta.env.PROD && !apiBaseUrl) {
    return Promise.reject(new ApiRequestError('生产环境 API 地址尚未配置。'));
  }
  return httpClient.request<T>(config).then((response) => response.data);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) window.localStorage.setItem(accessTokenStorageKey, token);
  else window.localStorage.removeItem(accessTokenStorageKey);
}

export { apiBaseUrl, accessTokenStorageKey };
