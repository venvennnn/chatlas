import type { Snapshot } from "../../../packages/shared/src/index";
export async function api<T = any>(
  path: string,
  body?: unknown,
  method = body === undefined ? "GET" : "POST",
): Promise<T> {
  const r = await fetch("/api" + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Chatlas-Client": "dashboard",
      "Idempotency-Key": crypto.randomUUID(),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "Request failed");
  return data;
}
export function subscribe(
  overlay: boolean,
  onState: (s: Snapshot) => void,
  onStatus: (v: boolean) => void,
) {
  let stopped = false,
    socket: WebSocket,
    timer: ReturnType<typeof setTimeout>;
  const connect = () => {
    socket = new WebSocket(
      `${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws${overlay ? "/overlay" : ""}`,
    );
    socket.onopen = () => onStatus(true);
    socket.onmessage = (e) => {
      const s = JSON.parse(e.data);
      if (s.schemaVersion === 1) onState(s);
    };
    socket.onclose = () => {
      onStatus(false);
      if (!stopped) timer = setTimeout(connect, 2000);
    };
  };
  connect();
  return () => {
    stopped = true;
    clearTimeout(timer);
    socket?.close();
  };
}
