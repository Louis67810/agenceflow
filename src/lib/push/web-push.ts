import crypto from "crypto";

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
}

type SendPushOptions = {
  ttl?: number;
  urgency?: "very-low" | "low" | "normal" | "high";
};

function base64UrlToBuffer(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Buffer.from(padded, "base64");
}

function bufferToBase64Url(buffer: Buffer) {
  return buffer.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function hmacSha256(key: Buffer, data: Buffer | string) {
  return crypto.createHmac("sha256", key).update(data).digest();
}

function hkdf(salt: Buffer, ikm: Buffer, info: Buffer | string, length: number) {
  const prk = hmacSha256(salt, ikm);
  const infoBuffer = Buffer.isBuffer(info) ? info : Buffer.from(info);
  let previous = Buffer.alloc(0);
  const buffers: Buffer[] = [];
  let counter = 1;

  while (Buffer.concat(buffers).length < length) {
    previous = hmacSha256(prk, Buffer.concat([previous, infoBuffer, Buffer.from([counter])]));
    buffers.push(previous);
    counter += 1;
  }

  return Buffer.concat(buffers).subarray(0, length);
}

function derToJose(signature: Buffer) {
  let offset = 3;
  let rLength = signature[offset - 1];
  if (rLength === 33) {
    offset += 1;
    rLength -= 1;
  }
  const r = signature.subarray(offset, offset + rLength).toString("hex").padStart(64, "0");
  offset += rLength + 2;
  let sLength = signature[offset - 1];
  if (sLength === 33) {
    offset += 1;
    sLength -= 1;
  }
  const s = signature.subarray(offset, offset + sLength).toString("hex").padStart(64, "0");
  return Buffer.from(r + s, "hex");
}

function getVapidKeys() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:notifications@agenceflow.local";

  if (!publicKey || !privateKey) {
    throw new Error("VAPID keys are missing. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.");
  }

  const publicKeyBuffer = base64UrlToBuffer(publicKey);
  if (publicKeyBuffer.length !== 65) throw new Error("NEXT_PUBLIC_VAPID_PUBLIC_KEY must be an uncompressed P-256 public key.");

  return { publicKey, privateKey, subject, publicKeyBuffer };
}

function createVapidJwt(endpoint: string) {
  const { publicKey, privateKey, subject, publicKeyBuffer } = getVapidKeys();
  const audience = new URL(endpoint).origin;
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  };

  const signingInput = `${bufferToBase64Url(Buffer.from(JSON.stringify(header)))}.${bufferToBase64Url(Buffer.from(JSON.stringify(payload)))}`;
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: bufferToBase64Url(publicKeyBuffer.subarray(1, 33)),
    y: bufferToBase64Url(publicKeyBuffer.subarray(33, 65)),
    d: privateKey,
  };
  const key = crypto.createPrivateKey({ key: jwk, format: "jwk" });
  const derSignature = crypto.sign("sha256", Buffer.from(signingInput), key);
  const signature = bufferToBase64Url(derToJose(derSignature));

  return { authorization: `vapid t=${signingInput}.${signature}, k=${publicKey}`, publicKey };
}

function encryptPayload(subscription: PushSubscriptionJSON, payload: PushPayload) {
  const receiverPublicKey = base64UrlToBuffer(subscription.keys.p256dh);
  const authSecret = base64UrlToBuffer(subscription.keys.auth);
  const salt = crypto.randomBytes(16);
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const senderPublicKey = ecdh.getPublicKey();
  const sharedSecret = ecdh.computeSecret(receiverPublicKey);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), receiverPublicKey, senderPublicKey]);
  const ikm = hkdf(authSecret, sharedSecret, keyInfo, 32);
  const cek = hkdf(salt, ikm, "Content-Encoding: aes128gcm\0", 16);
  const nonce = hkdf(salt, ikm, "Content-Encoding: nonce\0", 12);
  const plaintext = Buffer.concat([Buffer.from(JSON.stringify(payload)), Buffer.from([0x02])]);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);

  return Buffer.concat([salt, recordSize, Buffer.from([senderPublicKey.length]), senderPublicKey, ciphertext]);
}

export async function sendWebPush(subscription: PushSubscriptionJSON, payload: PushPayload, options: SendPushOptions = {}) {
  const body = encryptPayload(subscription, payload);
  const { authorization } = createVapidJwt(subscription.endpoint);

  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      TTL: String(options.ttl ?? 60 * 60),
      Urgency: options.urgency ?? "normal",
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      Authorization: authorization,
    },
    body,
  });
}
