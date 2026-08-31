const net = require('node:net');

const CLIENT_ID = '1543998755139879082';

class DiscordRPC {
  constructor(clientId) {
    this.clientId = clientId || CLIENT_ID;
    this.socket = null;
    this.connected = false;
    this.ready = false;
    this._reqId = 0;
    this._pending = new Map();
    this._buffer = Buffer.alloc(0);
    this._reconnectTimer = null;
  }

  connect() {
    const pipes = Array.from({ length: 10 }, (_, i) => `\\\\.\\pipe\\discord-ipc-${i}`);
    return this._tryConnect(pipes, 0);
  }

  _tryConnect(pipes, index) {
    if (index >= pipes.length) {
      this._scheduleReconnect();
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      const pipePath = pipes[index];
      let settled = false;

      const done = (success) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        if (success) resolve(true);
        else resolve(this._tryConnect(pipes, index + 1));
      };

      const timeout = setTimeout(() => { try { sock.destroy(); } catch {} done(false); }, 3000);

      const sock = net.connect(pipePath, () => {
        this.socket = sock;
        this._buffer = Buffer.alloc(0);
        this._bindSocket();
        const payload = JSON.stringify({ v: 1, client_id: this.clientId });
        this._rawSend(0, payload);
        done(true);
      });

      sock.on('error', () => {
        try { sock.destroy(); } catch {}
        done(false);
      });
    });
  }

  _bindSocket() {
    this.socket.on('data', (chunk) => {
      this._buffer = Buffer.concat([this._buffer, chunk]);
      while (this._buffer.length >= 8) {
        const op = this._buffer.readUInt32LE(0);
        const len = this._buffer.readUInt32LE(4);
        if (len > 65536) { this._buffer = Buffer.alloc(0); break; }
        if (this._buffer.length < 8 + len) break;
        const data = this._buffer.slice(8, 8 + len);
        this._buffer = this._buffer.slice(8 + len);
        this._onMessage(op, data);
      }
    });

    this.socket.on('close', () => {
      this.connected = false;
      this.ready = false;
      this.socket = null;
      this._scheduleReconnect();
    });

    this.socket.on('error', () => {});
  }

  _onMessage(op, data) {
    const str = data.toString();
    if (op === 1 || op === 2) {
      try {
        const msg = JSON.parse(str);
        const event = msg.cmd || msg.evt;
        if (event === 'READY') {
          this.ready = true;
          this.connected = true;
        }
        if (msg.nonce && this._pending.has(msg.nonce)) {
          this._pending.get(msg.nonce)(msg);
          this._pending.delete(msg.nonce);
        }
      } catch {}
    } else if (op === 3) {
      this._rawSend(3, str);
    }
  }

  _rawSend(op, data) {
    if (!this.socket) return false;
    const buf = Buffer.from(data, 'utf8');
    const header = Buffer.alloc(8);
    header.writeUInt32LE(op, 0);
    header.writeUInt32LE(buf.length, 4);
    try {
      this.socket.write(Buffer.concat([header, buf]));
      return true;
    } catch {
      return false;
    }
  }

  _request(cmd, args = {}) {
    return new Promise((resolve) => {
      if (!this.socket || !this.ready) { resolve(null); return; }
      const nonce = String(++this._reqId);
      this._pending.set(nonce, (msg) => resolve(msg));
      if (!this._rawSend(1, JSON.stringify({ cmd, args, nonce }))) {
        this._pending.delete(nonce);
        resolve(null);
        return;
      }
      setTimeout(() => {
        if (this._pending.has(nonce)) {
          this._pending.delete(nonce);
          resolve(null);
        }
      }, 5000);
    });
  }

  setActivity({ details, state, largeImageKey, largeImageText, smallImageKey, smallImageText, buttons } = {}) {
    if (!this.ready || !this.socket) return Promise.resolve(null);
    const activity = {};
    if (details) activity.details = String(details).substring(0, 128);
    if (state) activity.state = String(state).substring(0, 128);
    if (largeImageKey || largeImageText || smallImageKey || smallImageText) {
      activity.assets = {};
      if (largeImageKey) activity.assets.large_image = largeImageKey;
      if (largeImageText) activity.assets.large_text = String(largeImageText).substring(0, 128);
      if (smallImageKey) activity.assets.small_image = smallImageKey;
      if (smallImageText) activity.assets.small_text = String(smallImageText).substring(0, 128);
    }
    if (buttons && buttons.length) {
      activity.buttons = buttons.slice(0, 2).map(b => ({
        label: String(b.label).substring(0, 32),
        url: b.url
      }));
    }
    return this._request('SET_ACTIVITY', { pid: process.pid, activity });
  }

  clearActivity() {
    if (!this.ready || !this.socket) return Promise.resolve(null);
    return this._request('SET_ACTIVITY', { pid: process.pid, activity: null });
  }

  disconnect() {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    if (this.socket) {
      try { this._rawSend(2, '{}'); } catch {}
      try { this.socket.destroy(); } catch {}
    }
    this.connected = false;
    this.ready = false;
    this.socket = null;
  }

  _scheduleReconnect() {
    if (this._reconnectTimer) clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => this.connect().catch(() => {}), 15000);
  }
}

module.exports = { DiscordRPC, CLIENT_ID };
