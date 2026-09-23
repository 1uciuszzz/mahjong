import type { LedgerEvent, PeerIdentity } from "./crypto";

export type PublicPeer = Pick<PeerIdentity, "peerId" | "alias" | "publicKey">;

export type RoomInvite = {
  kind: "ledger.offer";
  version: 1;
  roomId: string;
  roomName: string;
  roomKey: string;
  host: PublicPeer;
  offer: RTCSessionDescriptionInit;
};

type RoomAnswer = {
  kind: "ledger.answer";
  version: 1;
  roomId: string;
  guest: PublicPeer;
  answer: RTCSessionDescriptionInit;
};

type WireMessage =
  | { type: "hello"; peer: PublicPeer }
  | { type: "events"; events: LedgerEvent[] }
  | { type: "sync.request" }
  | { type: "mesh.peers"; peers: PublicPeer[] }
  | { type: "mesh.offer"; from: PublicPeer; toPeerId: string; offer: RTCSessionDescriptionInit }
  | { type: "mesh.answer"; from: PublicPeer; toPeerId: string; answer: RTCSessionDescriptionInit };

type Connection = {
  pc: RTCPeerConnection;
  channel?: RTCDataChannel;
  control: boolean;
  peerId?: string;
};

type TransportOptions = {
  role: "host" | "guest";
  roomId: string;
  identity: PeerIdentity;
  getEvents: () => Promise<LedgerEvent[]>;
  onEvents: (events: LedgerEvent[]) => void;
  onPeer: (peer: PublicPeer) => void;
  onStatus: (status: string) => void;
};

function publicPeer(identity: PeerIdentity): PublicPeer {
  return { peerId: identity.peerId, alias: identity.alias, publicKey: identity.publicKey };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPublicPeer(value: unknown): value is PublicPeer {
  return isRecord(value) && typeof value.peerId === "string" && typeof value.alias === "string" && isRecord(value.publicKey);
}

function isSessionDescription(value: unknown): value is RTCSessionDescriptionInit {
  return isRecord(value) && typeof value.type === "string" && typeof value.sdp === "string";
}

function isLedgerEvent(value: unknown): value is LedgerEvent {
  if (!isRecord(value)) return false;
  return (
    typeof value.eventId === "string" &&
    typeof value.roomId === "string" &&
    typeof value.actorId === "string" &&
    typeof value.actorAlias === "string" &&
    (value.kind === "expense.added" || value.kind === "expense.voided") &&
    typeof value.createdAt === "number" &&
    Array.isArray(value.parents) &&
    value.parents.every((parent) => typeof parent === "string") &&
    typeof value.iv === "string" &&
    typeof value.ciphertext === "string" &&
    typeof value.hash === "string" &&
    typeof value.signature === "string" &&
    isRecord(value.publicKey)
  );
}

function parseMessage(raw: string): WireMessage | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!isRecord(value) || typeof value.type !== "string") return null;
    switch (value.type) {
      case "hello":
        return isPublicPeer(value.peer) ? { type: "hello", peer: value.peer } : null;
      case "events":
        return Array.isArray(value.events) && value.events.every(isLedgerEvent)
          ? { type: "events", events: value.events }
          : null;
      case "sync.request":
        return { type: "sync.request" };
      case "mesh.peers":
        return Array.isArray(value.peers) && value.peers.every(isPublicPeer)
          ? { type: "mesh.peers", peers: value.peers }
          : null;
      case "mesh.offer":
        return isPublicPeer(value.from) && typeof value.toPeerId === "string" && isSessionDescription(value.offer)
          ? { type: "mesh.offer", from: value.from, toPeerId: value.toPeerId, offer: value.offer }
          : null;
      case "mesh.answer":
        return isPublicPeer(value.from) && typeof value.toPeerId === "string" && isSessionDescription(value.answer)
          ? { type: "mesh.answer", from: value.from, toPeerId: value.toPeerId, answer: value.answer }
          : null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

async function waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === "complete") return;
  await new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      pc.removeEventListener("icegatheringstatechange", onStateChange);
      window.setTimeout(() => resolve(), 0);
    };
    const onStateChange = () => {
      if (pc.iceGatheringState === "complete") finish();
    };
    pc.addEventListener("icegatheringstatechange", onStateChange);
    window.setTimeout(finish, 2500);
  });
}

function iceServers(): RTCIceServer[] {
  const raw = import.meta.env.VITE_ICE_SERVERS;
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is RTCIceServer => {
      if (!isRecord(entry)) return false;
      const urls = entry.urls;
      return typeof urls === "string" || (Array.isArray(urls) && urls.every((url) => typeof url === "string"));
    });
  } catch {
    return [];
  }
}

export class P2PTransport {
  private readonly connections = new Set<Connection>();
  private readonly meshConnections = new Map<string, Connection>();
  private readonly knownPeers = new Map<string, PublicPeer>();
  private pendingHostConnection: Connection | null = null;
  private hostConnection: Connection | null = null;
  private readonly seenEventIds = new Set<string>();

  public constructor(private readonly options: TransportOptions) {}

  private createConnection(control: boolean, peerId?: string): Connection {
    const pc = new RTCPeerConnection({ iceServers: iceServers() });
    const connection: Connection = { pc, control, peerId };
    this.connections.add(connection);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        this.options.onStatus("直连暂时中断，账本仍保存在本地");
      }
    };
    return connection;
  }

  private attachChannel(connection: Connection): void {
    const channel = connection.channel;
    if (!channel) return;
    channel.onopen = () => {
      this.options.onStatus("P2P 已连接");
      this.send(connection, { type: "hello", peer: publicPeer(this.options.identity) });
      void this.sendEvents(connection);
    };
    channel.onmessage = (event) => {
      if (typeof event.data === "string") void this.handleMessage(connection, event.data);
    };
    channel.onclose = () => {
      this.connections.delete(connection);
      if (connection.peerId && !connection.control) this.meshConnections.delete(connection.peerId);
      if (this.options.role === "host" && connection.control && connection.peerId) {
        this.knownPeers.delete(connection.peerId);
        this.broadcastPeerList();
      }
      this.options.onStatus("连接已断开，本地账本仍可继续使用");
    };
    channel.onerror = () => this.options.onStatus("P2P 通道发生错误");
  }

  private send(connection: Connection, message: WireMessage): void {
    if (connection.channel?.readyState === "open") connection.channel.send(JSON.stringify(message));
  }

  private broadcast(message: WireMessage, except?: Connection): void {
    for (const connection of this.connections) {
      if (connection !== except) this.send(connection, message);
    }
  }

  private broadcastLedgerEvents(events: LedgerEvent[], except?: Connection): void {
    for (const connection of this.connections) {
      const isGuestHostLink = this.options.role === "guest" && connection === this.hostConnection;
      const isMeshLink = !connection.control;
      if (connection !== except && (isGuestHostLink || isMeshLink)) {
        this.send(connection, { type: "events", events });
      }
    }
  }

  private sendToHost(message: WireMessage): void {
    if (this.hostConnection) this.send(this.hostConnection, message);
  }

  private sendToPeer(peerId: string, message: WireMessage): void {
    for (const connection of this.connections) {
      if (connection.control && connection.peerId === peerId) {
        this.send(connection, message);
        return;
      }
    }
  }

  private async sendEvents(connection: Connection): Promise<void> {
    const events = await this.options.getEvents();
    for (const event of events) this.seenEventIds.add(event.eventId);
    this.send(connection, { type: "events", events });
  }

  private broadcastPeerList(): void {
    if (this.options.role !== "host") return;
    const peers = [...this.knownPeers.values()];
    this.broadcast({ type: "mesh.peers", peers });
  }

  private async handleMessage(connection: Connection, raw: string): Promise<void> {
    const message = parseMessage(raw);
    if (!message) return;

    switch (message.type) {
      case "hello":
        connection.peerId = message.peer.peerId;
        this.options.onPeer(message.peer);
        if (this.options.role === "host" && connection.control) {
          this.knownPeers.set(message.peer.peerId, message.peer);
          this.send(connection, { type: "mesh.peers", peers: [...this.knownPeers.values()] });
          this.broadcastPeerList();
        }
        return;
      case "sync.request":
        await this.sendEvents(connection);
        return;
      case "events": {
        const fresh = message.events.filter((event) => {
          if (this.seenEventIds.has(event.eventId)) return false;
          this.seenEventIds.add(event.eventId);
          return true;
        });
        if (fresh.length) {
          this.options.onEvents(fresh);
          if (this.options.role === "guest") this.broadcastLedgerEvents(fresh, connection);
        }
        return;
      }
      case "mesh.peers":
        if (this.options.role === "guest") await this.ensureMeshConnections(message.peers);
        return;
      case "mesh.offer":
        if (this.options.role === "host") {
          this.sendToPeer(message.toPeerId, message);
        } else if (message.toPeerId === this.options.identity.peerId) {
          await this.acceptMeshOffer(message);
        }
        return;
      case "mesh.answer":
        if (this.options.role === "host") {
          this.sendToPeer(message.toPeerId, message);
        } else if (message.toPeerId === this.options.identity.peerId) {
          await this.acceptMeshAnswer(message);
        }
        return;
    }
  }

  public async createHostInvite(params: { roomId: string; roomName: string; roomKey: string }): Promise<string> {
    if (this.options.role !== "host") throw new Error("只有房主可以生成邀请");
    this.pendingHostConnection?.pc.close();
    const connection = this.createConnection(true);
    connection.channel = connection.pc.createDataChannel("ledger-control");
    this.attachChannel(connection);
    this.pendingHostConnection = connection;
    const offer = await connection.pc.createOffer();
    await connection.pc.setLocalDescription(offer);
    await waitForIceGathering(connection.pc);
    if (!connection.pc.localDescription) throw new Error("无法生成 WebRTC 邀请");
    const invite: RoomInvite = {
      kind: "ledger.offer",
      version: 1,
      roomId: params.roomId,
      roomName: params.roomName,
      roomKey: params.roomKey,
      host: publicPeer(this.options.identity),
      offer: connection.pc.localDescription,
    };
    this.options.onStatus("邀请已生成，等待首位成员加入");
    return JSON.stringify(invite);
  }

  public async acceptHostAnswer(raw: string): Promise<void> {
    if (this.options.role !== "host") throw new Error("只有房主可以接受回答");
    if (!this.pendingHostConnection) throw new Error("当前没有等待中的邀请");
    const answer = JSON.parse(raw) as RoomAnswer;
    if (answer.kind !== "ledger.answer" || answer.version !== 1 || answer.roomId !== this.options.roomId) {
      throw new Error("回答文本不属于当前房间");
    }
    const connection = this.pendingHostConnection;
    await connection.pc.setRemoteDescription(answer.answer);
    connection.peerId = answer.guest.peerId;
    this.pendingHostConnection = null;
    this.options.onPeer(answer.guest);
    this.options.onStatus("首位成员已接入，正在建立全互联");
  }

  public async joinFromInvite(raw: string): Promise<{ answer: string; invite: RoomInvite }> {
    if (this.options.role !== "guest") throw new Error("只有成员可以加入邀请");
    const invite = JSON.parse(raw) as RoomInvite;
    if (invite.kind !== "ledger.offer" || invite.version !== 1 || invite.roomId !== this.options.roomId) {
      throw new Error("邀请文本不属于当前房间");
    }
    const connection = this.createConnection(true);
    this.hostConnection = connection;
    connection.pc.ondatachannel = (event) => {
      connection.channel = event.channel;
      this.attachChannel(connection);
    };
    await connection.pc.setRemoteDescription(invite.offer);
    const answer = await connection.pc.createAnswer();
    await connection.pc.setLocalDescription(answer);
    await waitForIceGathering(connection.pc);
    if (!connection.pc.localDescription) throw new Error("无法生成加入回答");
    this.options.onPeer(invite.host);
    this.options.onStatus("已生成回答，等待房主确认");
    const result: RoomAnswer = {
      kind: "ledger.answer",
      version: 1,
      roomId: this.options.roomId,
      guest: publicPeer(this.options.identity),
      answer: connection.pc.localDescription,
    };
    return { answer: JSON.stringify(result), invite };
  }

  private async ensureMeshConnections(peers: PublicPeer[]): Promise<void> {
    for (const peer of peers) {
      if (peer.peerId === this.options.identity.peerId || this.meshConnections.has(peer.peerId)) continue;
      this.options.onPeer(peer);
      if (this.options.identity.peerId > peer.peerId) await this.createMeshOffer(peer);
    }
  }

  private async createMeshOffer(peer: PublicPeer): Promise<void> {
    const connection = this.createConnection(false, peer.peerId);
    connection.channel = connection.pc.createDataChannel("ledger-mesh");
    this.meshConnections.set(peer.peerId, connection);
    this.attachChannel(connection);
    const offer = await connection.pc.createOffer();
    await connection.pc.setLocalDescription(offer);
    await waitForIceGathering(connection.pc);
    if (!connection.pc.localDescription) throw new Error("无法生成成员直连邀请");
    this.sendToHost({
      type: "mesh.offer",
      from: publicPeer(this.options.identity),
      toPeerId: peer.peerId,
      offer: connection.pc.localDescription,
    });
  }

  private async acceptMeshOffer(message: Extract<WireMessage, { type: "mesh.offer" }>): Promise<void> {
    if (this.meshConnections.has(message.from.peerId)) return;
    const connection = this.createConnection(false, message.from.peerId);
    this.meshConnections.set(message.from.peerId, connection);
    connection.pc.ondatachannel = (event) => {
      connection.channel = event.channel;
      this.attachChannel(connection);
    };
    await connection.pc.setRemoteDescription(message.offer);
    const answer = await connection.pc.createAnswer();
    await connection.pc.setLocalDescription(answer);
    await waitForIceGathering(connection.pc);
    if (!connection.pc.localDescription) throw new Error("无法生成成员直连回答");
    this.sendToHost({
      type: "mesh.answer",
      from: publicPeer(this.options.identity),
      toPeerId: message.from.peerId,
      answer: connection.pc.localDescription,
    });
  }

  private async acceptMeshAnswer(message: Extract<WireMessage, { type: "mesh.answer" }>): Promise<void> {
    const connection = this.meshConnections.get(message.from.peerId);
    if (!connection) return;
    await connection.pc.setRemoteDescription(message.answer);
  }

  public broadcastEvents(events: LedgerEvent[]): void {
    const fresh = events.filter((event) => {
      if (this.seenEventIds.has(event.eventId)) return false;
      this.seenEventIds.add(event.eventId);
      return true;
    });
    if (fresh.length) {
      if (this.options.role === "host") this.broadcast({ type: "events", events: fresh });
      else this.broadcastLedgerEvents(fresh);
    }
  }

  public close(): void {
    for (const connection of this.connections) {
      connection.channel?.close();
      connection.pc.close();
    }
    this.pendingHostConnection?.pc.close();
    this.connections.clear();
    this.meshConnections.clear();
    this.knownPeers.clear();
    this.pendingHostConnection = null;
    this.hostConnection = null;
  }
}
