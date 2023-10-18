/* eslint-disable import/prefer-default-export */
import { getPublicKey } from 'nostr-tools';

export function getPublicKeyFromLocalstorage() {
  const secretKey = localStorage.getItem('pleb_sk');
  if (!secretKey) {
    throw new Error('No private key in localstorage');
  }
  return getPublicKey(secretKey);
}
