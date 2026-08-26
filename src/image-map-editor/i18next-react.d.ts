import 'i18next';

declare module 'i18next' {
  interface TFunction {
    (key: string | string[], options?: Record<string, unknown> | string): string;
  }
}
