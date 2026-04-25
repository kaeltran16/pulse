// Indirection over react-native-sse so tests can swap in a fake EventSource.
import EventSource, { type EventSourceListener } from 'react-native-sse';

export type CustomEvents = 'chunk' | 'done' | 'error';

export type SSEFactory = (url: string, init: {
  headers: Record<string, string>;
  method: 'POST';
  body: string;
}) => SSEHandle;

export interface SSEHandle {
  addEventListener(name: CustomEvents | 'open' | 'close', cb: (ev: { data?: string; type?: string }) => void): void;
  close(): void;
}

export const realSSE: SSEFactory = (url, init) => {
  const es = new EventSource<CustomEvents>(url, {
    method: init.method,
    headers: init.headers,
    body: init.body,
  });
  return {
    addEventListener: (name, cb) => es.addEventListener(name as CustomEvents, cb as EventSourceListener<CustomEvents>),
    close: () => es.close(),
  };
};
