type ActivityType = 'typing' | 'recording' | 'uploading' | 'idle';

type SocketEventHandler = (event: {
  type: string;
  fromUid?: string;
  chatId?: string;
  activity?: ActivityType;
  onlineMap?: Record<string, boolean>;
  payload?: unknown;
}) => void;

class RealtimeSocketClient {
  private ws: WebSocket | null = null;
  private uid: string | null = null;
  private listeners = new Set<SocketEventHandler>();
  private reconnectTimer: number | null = null;
  private retryMs = 1000;

  connect(uid: string) {
    if (this.uid === uid && this.ws && this.ws.readyState <= WebSocket.OPEN) {
      return;
    }
    this.uid = uid;
    this.openSocket();
  }

  private openSocket() {
    if (!this.uid || typeof window === 'undefined') return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/ws`;

    try {
      const socket = new WebSocket(url);
      this.ws = socket;

      socket.onopen = () => {
        this.retryMs = 1000;
        if (this.uid) {
          socket.send(JSON.stringify({ type: 'auth', uid: this.uid }));
        }
      };

      socket.onmessage = (evt) => {
        try {
          const parsed = JSON.parse(evt.data as string);
          for (const listener of this.listeners) {
            listener(parsed);
          }
        } catch {
          // Ignore invalid JSON
        }
      };

      socket.onclose = () => {
        this.ws = null;
        if (this.uid) {
          this.reconnectTimer = window.setTimeout(() => {
            this.retryMs = Math.min(this.retryMs * 1.6, 15000);
            this.openSocket();
          }, this.retryMs);
        }
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch {
      // Ignore connection errors
    }
  }

  disconnect() {
    this.uid = null;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(handler: SocketEventHandler): () => void {
    this.listeners.add(handler);
    return () => {
      this.listeners.delete(handler);
    };
  }

  sendActivity(chatId: string, targetUids: string[], activity: ActivityType) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'chat:activity', chatId, targetUids, activity }));
  }

  sendRtcSignal(targetUids: string[], payload: unknown) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'rtc:signal', targetUids, payload }));
  }

  pingPresence(targetUids: string[]) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || targetUids.length === 0) return;
    this.ws.send(JSON.stringify({ type: 'presence:ping', targetUids }));
  }
}

export const realtimeSocket = new RealtimeSocketClient();
