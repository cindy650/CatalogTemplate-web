import type { OrderSavedEvent, SseNotificationEvent } from '@shared/events';
import { apiBaseUrl, getApiAuthHeaders } from '../api/httpClient';

const orderSavedEventType = 'order.saved';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isOrderSavedEvent(value: SseNotificationEvent): value is OrderSavedEvent {
  return value.type === orderSavedEventType
    && isRecord(value.data)
    && isRecord(value.data.order);
}

function normalizeEventPayload(raw: unknown, eventName: string, eventId: string): SseNotificationEvent | undefined {
  const source = isRecord(raw) ? raw : { msg: typeof raw === 'string' ? raw : '' };
  const msg = typeof source.msg === 'string'
    ? source.msg
    : typeof source.message === 'string'
      ? source.message
      : isRecord(source.data) && typeof source.data.message === 'string' ? source.data.message : '';
  if (!msg.trim()) return undefined;
  const type = typeof source.type === 'string' && source.type.trim()
    ? source.type.trim()
    : eventName || 'message';
  const id = typeof source.id === 'string' && source.id.trim()
    ? source.id
    : eventId || `${type}:${Date.now()}`;
  const createdAt = typeof source.created_at === 'string' && source.created_at.trim()
    ? source.created_at
    : new Date().toISOString();
  return {
    id,
    type,
    created_at: createdAt,
    msg,
    ...(isRecord(source.data) ? { data: source.data } : {}),
  };
}

type OrderEventStreamOptions = {
  onOrderSaved(event: OrderSavedEvent): void;
  onNotification?(event: SseNotificationEvent): void;
};

type SseFrame = {
  eventName: string;
  eventId: string;
  data: string;
};

function parseSseFrame(lines: string[]): SseFrame | undefined {
  let eventName = '';
  let eventId = '';
  const data: string[] = [];
  lines.forEach((line) => {
    if (!line || line.startsWith(':')) return;
    const separator = line.indexOf(':');
    const field = separator < 0 ? line : line.slice(0, separator);
    const value = separator < 0 ? '' : line.slice(separator + 1).replace(/^ /, '');
    if (field === 'event') eventName = value;
    else if (field === 'id') eventId = value;
    else if (field === 'data') data.push(value);
  });
  return data.length > 0 ? { eventName, eventId, data: data.join('\n') } : undefined;
}

function waitForReconnect(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = window.setTimeout(resolve, delay);
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer);
      resolve();
    }, { once: true });
  });
}

export function connectOrderEventStream({ onOrderSaved, onNotification }: OrderEventStreamOptions): () => void {
  const eventsUrl = apiBaseUrl ? `${apiBaseUrl}/events` : undefined;
  if (!eventsUrl || typeof fetch !== 'function') return () => undefined;

  const controller = new AbortController();
  const seenEventIds = new Set<string>();
  const rememberEvent = (event: SseNotificationEvent, frame: SseFrame) => {
    const key = frame.eventId || `${event.id}:${event.type}:${event.msg}`;
    if (seenEventIds.has(key)) return false;
    seenEventIds.add(key);
    if (seenEventIds.size > 1000) seenEventIds.delete(seenEventIds.values().next().value as string);
    return true;
  };
  const dispatchFrame = (frame: SseFrame) => {
    try {
      const payload = normalizeEventPayload(JSON.parse(frame.data), frame.eventName, frame.eventId);
      if (!payload || !rememberEvent(payload, frame)) return;
      if (isOrderSavedEvent(payload)) onOrderSaved(payload);
      else onNotification?.(payload);
    } catch (error) {
      console.warn('[SSE] 无法解析通知事件。', error);
    }
  };

  const run = async () => {
    while (!controller.signal.aborted) {
      try {
        const response = await fetch(eventsUrl, {
          headers: { Accept: 'text/event-stream', ...getApiAuthHeaders() },
          credentials: 'include',
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error(`SSE 连接失败（${response.status}）`);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let frameLines: string[] = [];
        while (!controller.signal.aborted) {
          const result = await reader.read();
          if (result.done) break;
          buffer += decoder.decode(result.value, { stream: true });
          const lines = buffer.split(/\r?\n/);
          buffer = lines.pop() ?? '';
          lines.forEach((line) => {
            if (line === '') {
              const frame = parseSseFrame(frameLines);
              if (frame) dispatchFrame(frame);
              frameLines = [];
            } else {
              frameLines.push(line);
            }
          });
        }
        if (buffer || frameLines.length > 0) {
          const frame = parseSseFrame([...frameLines, ...(buffer ? [buffer] : [])]);
          if (frame) dispatchFrame(frame);
        }
      } catch (error) {
        if (!controller.signal.aborted) console.warn('[SSE] 连接中断，正在重连。', error);
      }
      await waitForReconnect(1000, controller.signal);
    }
  };
  void run();
  return () => controller.abort();
}
