export type SseNotificationEvent = {
  id: string;
  type: string;
  created_at: string;
  msg: string;
  data?: Record<string, unknown>;
};

export type OrderSavedEvent = SseNotificationEvent & {
  type: 'order.saved';
  data: {
    order: Record<string, unknown>;
  };
};
