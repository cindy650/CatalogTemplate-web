export type OrderSavedEvent = {
  id: string;
  type: 'order.saved';
  created_at: string;
  data: {
    order: Record<string, unknown>;
    google_sheets: Record<string, unknown>;
    source: string;
  };
};
