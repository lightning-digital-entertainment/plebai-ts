import { Event, EventTemplate } from 'nostr-tools';

declare global {
  interface Window {
    nostr: {
      signEvent: (unsignedEvent: EventTemplate) => Promise<Event>;
      getPublicKey: () => Promise<string>;
      encrypt: (pk: PublicKey, message: string) => Promise<string>;
      decrypt: (pk: PublicKey, encryptedMessage: string) => Promise<string>;
    };
    webln: any;
  }
}

export type EncodedPublicKey = `npub${string}`;
export type PublicKey = string;

export type ConversationConfig = {
  useWebLn: boolean;
  secretKeyMethod: 'nip07' | 'throwaway' | 'localstorage';
  providerHost: string;
};
