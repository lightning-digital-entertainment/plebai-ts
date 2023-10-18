import {
  Event,
  EventTemplate,
  SimplePool,
  generatePrivateKey,
  getEventHash,
  getPublicKey,
  getSignature,
} from 'nostr-tools';
import { getPublicKeyFromLocalstorage } from './keys.js';
import {
  encryptMessage,
  encryptMessageFromLocalstorage,
} from './messages.js';

declare global {
  interface Window {
    nostr: {
      signEvent: (unsignedEvent: EventTemplate) => Promise<Event>;
      getPublicKey: () => Promise<string>;
      encrypt: (pk: PublicKey, message: string) => Promise<string>;
      decrypt: (pk: PublicKey, encryptedMessage: string) => Promise<string>;
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

  relays: string[];

  private relayPool: SimplePool;

  secretKeyMethod: 'nip07' | 'throwaway' | 'localstorage' = 'throwaway';

  private secretKey?: string;

  publicKey?: string;

  providerHost: string = 'https://plebai.com';

  constructor(
    agentKey: EncodedPublicKey | PublicKey,
    relays: string[],
    configObject: ConversationConfig
  ) {
    this.agentKey = agentKey;
    this.relays = relays;
    this.relayPool = new SimplePool();
    if (configObject) {
      if (configObject.useWebLn) {
        this.useWebLn = true;
      }
      if (configObject.secretKeyMethod) {
        this.secretKeyMethod = configObject.secretKeyMethod;
        if (configObject.secretKeyMethod === 'throwaway') {
          console.log('works')
          this.createAndSaveThrowawayKey();
        }
      } else {
        this.createAndSaveThrowawayKey();
      }
    }
  }

  private createAndSaveThrowawayKey() {
    const key = generatePrivateKey();
    this.publicKey = getPublicKey(key);
    this.secretKey = key;
    console.log(this.secretKey)
  }

  private async encryptMessage(
    receiverPublicKey: PublicKey,
    message: string
  ): Promise<string> {
    if (this.secretKeyMethod === 'nip07') {
      if (!window.nostr.encrypt) {
        throw new Error('Nip07 Provider does not support encryption');
      }
      return window.nostr.encrypt(receiverPublicKey, message);
    }
    if (this.secretKeyMethod === 'localstorage') {
      return encryptMessageFromLocalstorage(message, receiverPublicKey);
    }
    if (this.secretKeyMethod === 'throwaway') {
      if (!this.secretKey) {
        throw new Error(
          'Throwaway key was selected as method, but none was set on class construction'
        );
      }
      return encryptMessage(receiverPublicKey, this.secretKey, message);
      
    }
    throw new Error('No valid private key Method was selected');
  }

  async createKind4(message: string) {
    const encryptedMessage = await this.encryptMessage(this.agentKey, message);
    const event = {
      kind: 4,
      created_at: Math.floor(Date.now() / 1000),
      tags: [['p', this.agentKey]],
      content: encryptedMessage,
    };
    return this.singEvent(event);
  }

  async sub(callback: (e: Event<4>) => void) {
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
    this.relayPool
      .sub(this.relays, [
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

  async sendPrompt(prompt: string) {
    const event = await this.createKind4(prompt);
    const pubs = this.relayPool.publish(this.relays, event);
    return Promise.all(pubs)
  }
}

export default Conversation;
