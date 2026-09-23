export type JsonWebKeyRecord = JsonWebKey;

export type PeerIdentity = {
  peerId: string;
  alias: string;
  publicKey: JsonWebKeyRecord;
  privateKey: JsonWebKeyRecord;
};

export type ExpensePayload = {
  kind: "expense";
  payerId: string;
  payeeId: string;
  amountCents: number;
  note: string;
};

export type VoidedExpensePayload = {
  kind: "expense.voided";
  targetEventId: string;
  reason: string;
};

export type LedgerPayload = ExpensePayload | VoidedExpensePayload;

export type LedgerEvent = {
  eventId: string;
  roomId: string;
  actorId: string;
  actorAlias: string;
  kind: "expense.added" | "expense.voided";
  createdAt: number;
  parents: string[];
  iv: string;
  ciphertext: string;
  hash: string;
  signature: string;
  publicKey: JsonWebKeyRecord;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function assertCryptoAvailable() {
  if (!globalThis.crypto?.subtle) {
    throw new Error("当前页面没有可用的 Web Crypto。请使用 HTTPS 或 localhost 打开应用。");
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomId(prefix: string): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return `${prefix}_${bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "")}`;
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortValue(entry)])
    );
  }
  return value;
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

async function sha256(value: string): Promise<string> {
  assertCryptoAvailable();
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

async function importSigningPrivateKey(key: JsonWebKeyRecord): Promise<CryptoKey> {
  assertCryptoAvailable();
  return crypto.subtle.importKey(
    "jwk",
    key,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

async function importSigningPublicKey(key: JsonWebKeyRecord): Promise<CryptoKey> {
  assertCryptoAvailable();
  return crypto.subtle.importKey(
    "jwk",
    key,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
}

async function sign(value: string, key: JsonWebKeyRecord): Promise<string> {
  const privateKey = await importSigningPrivateKey(key);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    encoder.encode(value)
  );
  return bytesToBase64(new Uint8Array(signature));
}

async function verify(
  value: string,
  signature: string,
  key: JsonWebKeyRecord
): Promise<boolean> {
  const publicKey = await importSigningPublicKey(key);
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    base64ToBytes(signature),
    encoder.encode(value)
  );
}

export async function createPeerIdentity(alias: string): Promise<PeerIdentity> {
  assertCryptoAvailable();
  const keyPair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"]
  );
  const publicKey = await crypto.subtle.exportKey("jwk", keyPair.publicKey);
  const privateKey = await crypto.subtle.exportKey("jwk", keyPair.privateKey);
  const peerId = (await sha256(canonicalJson(publicKey))).slice(0, 16);
  return { peerId, alias: alias.trim(), publicKey, privateKey };
}

export async function createRoomKey(): Promise<string> {
  assertCryptoAvailable();
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes);
}

async function importRoomKey(roomKey: string): Promise<CryptoKey> {
  assertCryptoAvailable();
  return crypto.subtle.importKey(
    "raw",
    base64ToBytes(roomKey),
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptPayload(
  roomKey: string,
  payload: LedgerPayload
): Promise<{ iv: string; ciphertext: string }> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await importRoomKey(roomKey);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(canonicalJson(payload))
  );
  return { iv: bytesToBase64(iv), ciphertext: bytesToBase64(new Uint8Array(ciphertext)) };
}

export async function decryptPayload(
  roomKey: string,
  event: Pick<LedgerEvent, "iv" | "ciphertext">
): Promise<LedgerPayload> {
  const key = await importRoomKey(roomKey);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(event.iv) },
    key,
    base64ToBytes(event.ciphertext)
  );
  const parsed = JSON.parse(decoder.decode(plaintext)) as Partial<LedgerPayload> & {
    payerId?: string;
    payeeId?: string;
    amountCents?: number;
    note?: string;
  };
  if (!parsed.kind && parsed.payerId && parsed.payeeId && typeof parsed.amountCents === "number") {
    return {
      kind: "expense",
      payerId: parsed.payerId,
      payeeId: parsed.payeeId,
      amountCents: parsed.amountCents,
      note: parsed.note ?? "",
    };
  }
  return parsed as LedgerPayload;
}

export async function createLedgerEvent(params: {
  roomId: string;
  roomKey: string;
  identity: PeerIdentity;
  parents: string[];
  kind: LedgerEvent["kind"];
  payload: LedgerPayload;
}): Promise<LedgerEvent> {
  const encrypted = await encryptPayload(params.roomKey, params.payload);
  const unsigned = {
    eventId: randomId("evt"),
    roomId: params.roomId,
    actorId: params.identity.peerId,
    actorAlias: params.identity.alias,
    kind: params.kind,
    createdAt: Date.now(),
    parents: [...params.parents].sort(),
    iv: encrypted.iv,
    ciphertext: encrypted.ciphertext,
  };
  const hash = await sha256(canonicalJson(unsigned));
  const signature = await sign(hash, params.identity.privateKey);
  return { ...unsigned, hash, signature, publicKey: params.identity.publicKey };
}

export async function verifyLedgerEvent(
  event: LedgerEvent,
  roomId: string
): Promise<boolean> {
  try {
    const unsigned = {
      eventId: event.eventId,
      roomId: event.roomId,
      actorId: event.actorId,
      actorAlias: event.actorAlias,
      kind: event.kind,
      createdAt: event.createdAt,
      parents: [...event.parents].sort(),
      iv: event.iv,
      ciphertext: event.ciphertext,
    };
    const calculatedHash = await sha256(canonicalJson(unsigned));
    const publicKeyPeerId = (await sha256(canonicalJson(event.publicKey))).slice(0, 16);
    return (
      event.roomId === roomId &&
      event.actorId === publicKeyPeerId &&
      event.hash === calculatedHash &&
      (await verify(event.hash, event.signature, event.publicKey))
    );
  } catch {
    return false;
  }
}

type BackupEnvelope = {
  version: 1;
  algorithm: "PBKDF2-SHA-256/AES-GCM";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
};

export async function encryptBackup(password: string, data: unknown): Promise<string> {
  assertCryptoAvailable();
  if (password.length < 6) throw new Error("备份密码至少需要 6 位");
  const salt = new Uint8Array(16);
  const iv = new Uint8Array(12);
  crypto.getRandomValues(salt);
  crypto.getRandomValues(iv);
  const iterations = 210_000;
  const passwordKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(data))
  );
  const envelope: BackupEnvelope = {
    version: 1,
    algorithm: "PBKDF2-SHA-256/AES-GCM",
    iterations,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
  return JSON.stringify(envelope, null, 2);
}

export async function decryptBackup<T>(password: string, content: string): Promise<T> {
  assertCryptoAvailable();
  let envelope: BackupEnvelope;
  try {
    envelope = JSON.parse(content) as BackupEnvelope;
  } catch {
    throw new Error("备份文件不是有效 JSON");
  }
  if (envelope.version !== 1 || envelope.algorithm !== "PBKDF2-SHA-256/AES-GCM") {
    throw new Error("不支持的备份格式");
  }
  const passwordKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: base64ToBytes(envelope.salt), iterations: envelope.iterations, hash: "SHA-256" },
    passwordKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
      key,
      base64ToBytes(envelope.ciphertext)
    );
    return JSON.parse(decoder.decode(plaintext)) as T;
  } catch {
    throw new Error("备份密码错误或文件已损坏");
  }
}
