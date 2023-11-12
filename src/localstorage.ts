import {
  Event,
  EventTemplate,
  getEventHash,
  getPublicKey,
  getSignature,
  nip04,
} from 'nostr-tools';

export async function encryptMessageFromLocalstorage(
  message: string,
  receiverPublicKey: string,
): Promise<string> {
  const userSecretKey = localStorage.getItem('pleb_sk');
  if (!userSecretKey) {
    throw new Error('No private key in localstorage...');
  }
  return nip04.encrypt(userSecretKey, receiverPublicKey, message);
}

export function getPublicKeyFromLocalstorage() {
  const secretKey = localStorage.getItem('pleb_sk');
  if (!secretKey) {
    throw new Error('No private key in localstorage');
  }
  return getPublicKey(secretKey);
}

export async function decryptMessageFromLocalstorage(
  encryptedMessage: string,
  senderPublicKey: string,
): Promise<string> {
  const userSecretKey = localStorage.getItem('pleb_sk');
  if (!userSecretKey) {
    throw new Error('No private key in localstorage...');
  }
  return nip04.decrypt(userSecretKey, senderPublicKey, encryptedMessage);
}

export function signFromLocalstorage(event: EventTemplate): Event {
  const userSecretKey = localStorage.getItem('pleb_sk');
  if (!userSecretKey) {
    throw new Error('No private key in localstorage...');
  }
  const publicKey = getPublicKey(userSecretKey);
  const signedEvent = {
    ...event,
    pubkey: publicKey,
    id: '',
    sig: '',
  };
  signedEvent.id = getEventHash(signedEvent);
  signedEvent.sig = getSignature(signedEvent, userSecretKey);
  return signedEvent;
}
