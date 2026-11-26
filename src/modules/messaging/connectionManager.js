export class ConnectionManager {
  constructor() {
    this.connections = new Map();
  }

  addConnection(userId, socket) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId).add(socket);
  }

  removeConnection(userId, socket) {
    const sockets = this.connections.get(userId);
    if (sockets) {
      sockets.delete(socket);
      if (sockets.size === 0) {
        this.connections.delete(userId);
      }
    }
  }

  sendToUser(userId, payload) {
    const sockets = this.connections.get(userId);
    if (!sockets) return false;

    const data = JSON.stringify(payload);
    for (const socket of sockets) {
      if (socket.readyState === 1 /* OPEN */) {
        socket.send(data);
      }
    }
    return true;
  }
}

export const connectionManager = new ConnectionManager();
