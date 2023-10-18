import {
  Event,
  EventTemplate,
  SimplePool,
  generatePrivateKey,
  getEventHash,
  getPublicKey,
  getSignature,
} from 'nostr-tools';
import { getPublicKeyFromLocalstorage } from './utils/keys';

declare global {
  interface Window {
    nostr: {
      signEvent: (unsignedEvent: EventTemplate) => Promise<Event>;
      getPublicKey: () => Promise<string>;
    };
  }
}

type EncodedPublicKey = `npub${string}`;
type PublicKey = string;

type ConversationConfig = {
  useWebLn: boolean;
  secretKeyMethod: 'nip07' | 'throwaway' | 'localstorage';
  providerHost: string;
};

class Conversation {
  agentKey: string;

  useWebLn: boolean = false;

  secretKeyMethod: 'nip07' | 'throwaway' | 'localstorage' = 'throwaway';

  secretKey?: string;

  publicKey?: string;

  providerHost: string = 'https://plebai.com';

  constructor(
    agentKey: EncodedPublicKey | PublicKey,
    configObject: ConversationConfig,
  ) {
    this.agentKey = agentKey;
    if (configObject) {
      if (configObject.useWebLn) {
        this.useWebLn = true;
      }
      if (configObject.secretKeyMethod) {
        this.secretKeyMethod = configObject.secretKeyMethod;
        if (configObject.secretKeyMethod === 'throwaway') {
          this.createAndSaveThrowawayKey();
        }
      } else {
        this.createAndSaveThrowawayKey();
      }
    }
  }

  createAndSaveThrowawayKey() {
    const key = generatePrivateKey();
    this.publicKey = getPublicKey(key);
    this.secretKey = key;
  }

  async sub(relays: string[], callback: (e: Event<4>) => void) {
    const pool = new SimplePool();
    let userPublicKey: string | undefined;
    if (this.secretKeyMethod === 'nip07') {
      userPublicKey = await window.nostr.getPublicKey();
    }
    if (this.secretKeyMethod === 'localstorage') {
      userPublicKey = getPublicKeyFromLocalstorage();
    } else {
      userPublicKey = this.publicKey;
    }
    if (!userPublicKey) {
      throw new Error('No public key found');
    }
    pool
      .sub(relays, [
        { kinds: [4], authors: [userPublicKey], '#p': [this.agentKey] },
        { kinds: [4], authors: [this.agentKey], '#p': [userPublicKey] },
      ])
      .on('event', callback);
  }

  async singEvent(unsignedEvent: EventTemplate): Promise<Event> {
    if (this.secretKeyMethod === 'nip07') {
      const signedEvent = await window.nostr.signEvent(unsignedEvent);
      return signedEvent;
    }
    if (this.secretKeyMethod === 'throwaway') {
      if (!this.secretKey) {
        throw new Error('No secret key defined!');
      }
      const publicKey = getPublicKey(this.secretKey);
      const event = {
        pubkey: publicKey,
        ...unsignedEvent,
        id: '',
        sig: '',
      };
      event.id = getEventHash(event);
      event.sig = getSignature(event, this.secretKey);
      return event;
    }
    throw new Error('No valid private key available');
  }

  // TO-DO
  // async sendPrompt(prompt: string) {
  //   const unsignedKind4 = createUnsignedKind4()
  // }
}

export default Conversation;
