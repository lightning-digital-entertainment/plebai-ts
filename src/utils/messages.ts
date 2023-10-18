import { EventTemplate, nip04 } from 'nostr-tools';

export async function createUnsignedKind4(
  receiverPublicKey: string,
  senderPrivateKey: string,
  message: string
): Promise<EventTemplate> {
  const encryptedMessage = await nip04.encrypt(
    senderPrivateKey,
    receiverPublicKey,
    message
  );
  const event = {
    kind: 4,
    created_at: Math.floor(Date.now() / 1000),
    tags: [['p', receiverPublicKey]],
    content: encryptedMessage,
  };
  return event;
}

export async function decryptMessage(
  receiverPublicKey: string,
  senderSecretKey: string,
  encryptedMessage: string,
): Promise<string> {
  return nip04.decrypt(senderSecretKey, receiverPublicKey, encryptedMessage);
}

export async function encryptMessage(
  receiverPublicKey: string,
  senderPrivateKey: string,
  message: string,
) {
  return nip04.encrypt(senderPrivateKey, receiverPublicKey, message);
}

export async function encryptMessageFromLocalstorage(
  message: string,
  receiverPublicKey: string,
): Promise<string> {
  const userSecretKey = localStorage.getItem('pleb_sk');
  if (!userSecretKey) {
    throw new Error('No private key in localstorage');
  }
  return nip04.encrypt(userSecretKey, receiverPublicKey, message);
}

export async function decryptMessageFromLocalstorage(
  encryptedMessage: string,
  senderPublicKey: string,
): Promise<string> {
  const userSecretKey = localStorage.getItem('pleb_sk');
  if (!userSecretKey) {
    throw new Error('No private key in localstorage');
  }
  return nip04.decrypt(userSecretKey, senderPublicKey, encryptedMessage);
}
