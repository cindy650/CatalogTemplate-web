import type { OrderSavedEvent } from '@shared/events';
import { apiBaseUrl } from '../api/httpClient';

const orderSavedEventType = 'order.saved';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isOrderSavedEvent(value: unknown): value is OrderSavedEvent {
  if (!isRecord(value)) return false;
  const data = value.data;
  return (
    typeof value.id === 'string' &&
    value.type === orderSavedEventType &&
    typeof value.created_at === 'string' &&
    isRecord(data) &&
    isRecord(data.order) &&
    isRecord(data.google_sheets) &&
    typeof data.source === 'string'
  );
}

function getOrderEventsUrl(): string | undefined {
  return apiBaseUrl ? `${apiBaseUrl}/events` : undefined;
}

type OrderEventStreamOptions = {
  onOrderSaved(event: OrderSavedEvent): void;
};

export function connectOrderEventStream({ onOrderSaved }: OrderEventStreamOptions): () => void {
  const eventsUrl = getOrderEventsUrl();
  if (!eventsUrl) return () => undefined;

  const events = new EventSource(eventsUrl);
  const handleOrderSaved = (rawEvent: Event) => {
    const event = rawEvent as MessageEvent<string>;
    try {
      const payload: unknown = JSON.parse(event.data);
      if (!isOrderSavedEvent(payload)) {
        console.warn('[SSE] 忽略格式不符合约定的 order.saved 事件。');
        return;
      }
      onOrderSaved(payload);
    } catch (error) {
      console.warn('[SSE] 无法解析 order.saved 事件。', error);
    }
  };

  events.addEventListener(orderSavedEventType, handleOrderSaved);

  return () => {
    events.removeEventListener(orderSavedEventType, handleOrderSaved);
    events.close();
  };
}
