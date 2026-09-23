import type { LedgerEvent, PeerIdentity } from "./crypto";

export type RoomRecord = {
  roomId: string;
  name: string;
  roomKey: string;
  role: "host" | "guest";
  createdAt: number;
  hostPeerId: string;
  hostAlias: string;
  hostPublicKey?: JsonWebKey;
  inviteText?: string;
  answerText?: string;
  lastOpenedAt?: number;
};

type IdentityRecord = {
  id: "local";
  identity: PeerIdentity;
};

const DB_NAME = "p2p-ledger";
const DB_VERSION = 1;

let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error("无法打开本地数据库"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("identity")) {
        database.createObjectStore("identity", { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains("rooms")) {
        database.createObjectStore("rooms", { keyPath: "roomId" });
      }
      if (!database.objectStoreNames.contains("events")) {
        const store = database.createObjectStore("events", { keyPath: "eventId" });
        store.createIndex("roomId", "roomId", { unique: false });
      }
    };
  });
  return databasePromise;
}

export async function loadIdentity(): Promise<PeerIdentity | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction("identity", "readonly").objectStore("identity").get("local");
    request.onerror = () => reject(request.error ?? new Error("读取本地身份失败"));
    request.onsuccess = () => resolve((request.result as IdentityRecord | undefined)?.identity ?? null);
  });
}

export async function saveIdentity(identity: PeerIdentity): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction("identity", "readwrite").objectStore("identity").put({
      id: "local",
      identity,
    } satisfies IdentityRecord);
    request.onerror = () => reject(request.error ?? new Error("保存本地身份失败"));
    request.onsuccess = () => resolve();
  });
}

export async function saveRoom(room: RoomRecord): Promise<void> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction("rooms", "readwrite").objectStore("rooms").put(room);
    request.onerror = () => reject(request.error ?? new Error("保存房间失败"));
    request.onsuccess = () => resolve();
  });
}

export async function getRooms(): Promise<RoomRecord[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = database.transaction("rooms", "readonly").objectStore("rooms").getAll();
    request.onerror = () => reject(request.error ?? new Error("读取房间失败"));
    request.onsuccess = () => resolve((request.result as RoomRecord[]).sort((a, b) => (b.lastOpenedAt ?? b.createdAt) - (a.lastOpenedAt ?? a.createdAt)));
  });
}

export async function saveEvents(events: LedgerEvent[]): Promise<void> {
  if (!events.length) return;
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("events", "readwrite");
    const store = transaction.objectStore("events");
    for (const event of events) store.put(event);
    transaction.onerror = () => reject(transaction.error ?? new Error("保存账单失败"));
    transaction.oncomplete = () => resolve();
  });
}

export async function getEvents(roomId: string): Promise<LedgerEvent[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction("events", "readonly");
    const request = transaction.objectStore("events").index("roomId").getAll(roomId);
    request.onerror = () => reject(request.error ?? new Error("读取账单失败"));
    request.onsuccess = () => resolve((request.result as LedgerEvent[]).sort((a, b) => a.createdAt - b.createdAt));
  });
}
