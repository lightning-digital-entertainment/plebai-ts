import { nip04 } from 'nostr-tools';

export async function decryptMessage(
  publicKey: string,
  secretKey: string,
  encryptedMessage: string,
): Promise<string> {
  return nip04.decrypt(secretKey, publicKey, encryptedMessage);
}

export async function encryptMessage(
  receiverPublicKey: string,
  senderPrivateKey: string,
  message: string,
) {
  return nip04.encrypt(senderPrivateKey, receiverPublicKey, message);
}
