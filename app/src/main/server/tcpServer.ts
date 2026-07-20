import { createServer, type Server, type Socket } from 'node:net';
import { EventEmitter } from 'node:events';
import {
  parseLuaLine,
  encodeAppMessage,
  PROTOCOL_VERSION,
  type AppMessage,
  type LuaMessage
} from '../../shared/protocol/messages';

export interface LuaBridgeServerEvents {
  connect: [];
  disconnect: [];
  message: [LuaMessage];
  error: [Error];
}

/**
 * TCP server the Mesen Lua bridge connects to.
 * Single-client policy: a new connection replaces the previous one
 * (covers emulator restarts where the old socket lingers).
 */
export class LuaBridgeServer extends EventEmitter<LuaBridgeServerEvents> {
  private server: Server | null = null;
  private client: Socket | null = null;
  private buffer = '';

  get connected(): boolean {
    return this.client !== null;
  }

  start(port: number, host = '127.0.0.1'): Promise<void> {
    return new Promise((resolve, reject) => {
      const server = createServer((socket) => this.onConnection(socket));
      server.once('error', reject);
      server.listen(port, host, () => {
        server.removeListener('error', reject);
        server.on('error', (err) => this.emit('error', err));
        this.server = server;
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    this.client?.destroy();
    this.client = null;
    const server = this.server;
    this.server = null;
    if (server) await new Promise<void>((res) => server.close(() => res()));
  }

  send(msg: AppMessage): boolean {
    if (!this.client) return false;
    this.client.write(encodeAppMessage(msg));
    return true;
  }

  private onConnection(socket: Socket): void {
    if (this.client) {
      // Newest client wins; drop the stale one silently.
      this.client.removeAllListeners();
      this.client.destroy();
    }
    this.client = socket;
    this.buffer = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk: string) => this.onData(socket, chunk));
    const drop = () => {
      if (this.client === socket) {
        this.client = null;
        this.emit('disconnect');
      }
    };
    socket.on('close', drop);
    socket.on('error', drop);
    this.emit('connect');
    this.send({ t: 'welcome', proto: PROTOCOL_VERSION, pollHz: 6 });
  }

  private onData(socket: Socket, chunk: string): void {
    if (this.client !== socket) return;
    this.buffer += chunk;
    // Guard against a runaway peer that never sends a newline.
    if (this.buffer.length > 1_000_000) {
      this.buffer = '';
      return;
    }
    let idx: number;
    while ((idx = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 1);
      const msg = parseLuaLine(line);
      if (msg !== null) this.emit('message', msg);
    }
  }
}
