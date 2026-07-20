import { afterEach, describe, expect, it } from 'vitest';
import { connect, type Socket } from 'node:net';
import { LuaBridgeServer } from '../src/main/server/tcpServer';
import type { LuaMessage } from '../src/shared/protocol/messages';

const TEST_PORT = 42877;

let server: LuaBridgeServer | null = null;
let clients: Socket[] = [];

afterEach(async () => {
  for (const c of clients) c.destroy();
  clients = [];
  await server?.stop();
  server = null;
});

function connectClient(): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = connect(TEST_PORT, '127.0.0.1', () => resolve(socket));
    socket.once('error', reject);
    clients.push(socket);
  });
}

function nextEvent<T>(register: (cb: (value: T) => void) => void): Promise<T> {
  return new Promise((resolve) => register(resolve));
}

function readLine(socket: Socket): Promise<string> {
  return new Promise((resolve) => {
    let buf = '';
    const onData = (chunk: Buffer) => {
      buf += chunk.toString('utf8');
      const idx = buf.indexOf('\n');
      if (idx !== -1) {
        socket.removeListener('data', onData);
        resolve(buf.slice(0, idx));
      }
    };
    socket.on('data', onData);
  });
}

describe('LuaBridgeServer', () => {
  it('emits connect and sends a welcome to the client', async () => {
    server = new LuaBridgeServer();
    await server.start(TEST_PORT);
    const connected = nextEvent<void>((cb) => server!.once('connect', () => cb()));
    const client = await connectClient();
    await connected;
    expect(server.connected).toBe(true);
    const welcome = JSON.parse(await readLine(client));
    expect(welcome.t).toBe('welcome');
    expect(welcome.proto).toBe(1);
  });

  it('parses newline-delimited messages, including split and batched chunks', async () => {
    server = new LuaBridgeServer();
    await server.start(TEST_PORT);
    const messages: LuaMessage[] = [];
    server.on('message', (m) => messages.push(m));
    const client = await connectClient();
    await nextEvent<void>((cb) => {
      if (server!.connected) cb();
      else server!.once('connect', () => cb());
    });

    // one message split across two writes + two messages in one write
    client.write('{"t":"gamestate",');
    await new Promise((r) => setTimeout(r, 30));
    client.write('"v":1}\n{"t":"seed","checksum":"a1b2c3d4e5f60708"}\n{"t":"gamestate","v":3}\n');
    await new Promise((r) => setTimeout(r, 60));

    expect(messages).toEqual([
      { t: 'gamestate', v: 1 },
      { t: 'seed', checksum: 'a1b2c3d4e5f60708' },
      { t: 'gamestate', v: 3 }
    ]);
  });

  it('ignores garbage lines and keeps working', async () => {
    server = new LuaBridgeServer();
    await server.start(TEST_PORT);
    const messages: LuaMessage[] = [];
    server.on('message', (m) => messages.push(m));
    const client = await connectClient();
    client.write('garbage\n{"t":"gamestate","v":1}\n');
    await new Promise((r) => setTimeout(r, 60));
    expect(messages).toEqual([{ t: 'gamestate', v: 1 }]);
  });

  it('newest client wins', async () => {
    server = new LuaBridgeServer();
    await server.start(TEST_PORT);
    const messages: LuaMessage[] = [];
    server.on('message', (m) => messages.push(m));

    const first = await connectClient();
    await new Promise((r) => setTimeout(r, 30));
    const second = await connectClient();
    await new Promise((r) => setTimeout(r, 30));

    // Messages from the replaced first client are ignored.
    first.write('{"t":"gamestate","v":1}\n');
    second.write('{"t":"gamestate","v":3}\n');
    await new Promise((r) => setTimeout(r, 60));
    expect(messages).toEqual([{ t: 'gamestate', v: 3 }]);
  });

  it('emits disconnect when the client goes away', async () => {
    server = new LuaBridgeServer();
    await server.start(TEST_PORT);
    const client = await connectClient();
    await nextEvent<void>((cb) => {
      if (server!.connected) cb();
      else server!.once('connect', () => cb());
    });
    const disconnected = nextEvent<void>((cb) => server!.once('disconnect', () => cb()));
    client.destroy();
    await disconnected;
    expect(server.connected).toBe(false);
  });
});
