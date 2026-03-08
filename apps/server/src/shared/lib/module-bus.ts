type EventPayload = {
  topic: string;
  source: string;
  payload: unknown;
  timestamp: string;
};

type BusHandler = (event: EventPayload) => void;

class ModuleBus {
  private subscriptions = new Map<string, Set<BusHandler>>();

  subscribe(topic: string, handler: BusHandler) {
    const set = this.subscriptions.get(topic) ?? new Set<BusHandler>();
    set.add(handler);
    this.subscriptions.set(topic, set);

    return () => {
      const current = this.subscriptions.get(topic);
      if (!current) return;
      current.delete(handler);
      if (current.size === 0) {
        this.subscriptions.delete(topic);
      }
    };
  }

  publish(topic: string, source: string, payload: unknown) {
    const event: EventPayload = {
      topic,
      source,
      payload,
      timestamp: new Date().toISOString()
    };

    const direct = this.subscriptions.get(topic);
    if (direct) {
      for (const handler of direct) {
        handler(event);
      }
    }

    const wildcard = this.subscriptions.get('*');
    if (wildcard) {
      for (const handler of wildcard) {
        handler(event);
      }
    }
  }

  listTopics() {
    return [...this.subscriptions.keys()];
  }
}

export const moduleBus = new ModuleBus();

export type { EventPayload };
