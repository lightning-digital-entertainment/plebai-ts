import {
  Event,
  EventTemplate,
  SimplePool,
  generatePrivateKey,
  getEventHash,
  getPublicKey,
  getSignature,
} from 'nostr-tools';
import { decryptMessage, encryptMessage } from './messages.js';
import { getTagValue } from './tags.js';
import { ConversationConfig, EncodedPublicKey, PublicKey } from './types.js';
import { handleWebLnPayment } from './webLn.js';
import {
  decryptMessageFromLocalstorage,
  encryptMessageFromLocalstorage,
  getPublicKeyFromLocalstorage,
  signFromLocalstorage,
} from './localstorage.js';

type Listeners = {
  onMessage: (e: Event<4>, decryptedMessage: string) => void;
  onInvoice?: (lightningInvoice: string) => void;
  onProcessing?: () => void;
};

class Conversation {
  private agentKey: string;

  private useWebLn?: boolean = false;

  private relays: string[];

  private relayPool: SimplePool;

  private secretKeyMethod?: 'nip07' | 'throwaway' | 'localstorage' =
    'throwaway';

  private secretKey?: string;

  private publicKey?: string;

  constructor(
    agentKey: EncodedPublicKey | PublicKey,
    relays: string[],
    configObject: ConversationConfig,
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
          this.createAndSaveThrowawayKey();
        } else if (configObject.secretKeyMethod === 'localstorage') {
          // TO-DO
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
  }

  private async encryptMessage(
    receiverPublicKey: PublicKey,
    message: string,
  ): Promise<string> {
    if (this.secretKeyMethod === 'nip07') {
      if (!window.nostr.nip04.encrypt) {
        throw new Error('Nip07 Provider does not support encryption');
      }
      return window.nostr.nip04.encrypt(receiverPublicKey, message);
    }
    if (this.secretKeyMethod === 'localstorage') {
      return encryptMessageFromLocalstorage(message, receiverPublicKey);
    }
    if (this.secretKeyMethod === 'throwaway') {
      if (!this.secretKey) {
        throw new Error(
          'Throwaway key was selected as method, but none was set on class construction',
        );
      }
      return encryptMessage(receiverPublicKey, this.secretKey, message);
    }
    throw new Error('No valid private key Method was selected');
  }

  private async decryptMessage(
    senderPublicKey: PublicKey,
    message: string,
  ): Promise<string> {
    if (this.secretKeyMethod === 'nip07') {
      if (!window.nostr.nip04.decrypt) {
        throw new Error('Nip07 Provider does not support encryption');
      }
      return window.nostr.nip04.decrypt(senderPublicKey, message);
    }
    if (this.secretKeyMethod === 'localstorage') {
      return decryptMessageFromLocalstorage(message, senderPublicKey);
    }
    if (this.secretKeyMethod === 'throwaway') {
      if (!this.secretKey) {
        throw new Error(
          'Throwaway key was selected as method, but none was set on class construction',
        );
      }
      return decryptMessage(senderPublicKey, this.secretKey, message);
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

  async sub(listeners: Listeners) {
    if (!listeners.onInvoice && !this.useWebLn) {
      throw new Error('InvoiceCallback is required when useWebLn is false.');
    }
    let userPublicKey: string | undefined;
    switch (this.secretKeyMethod) {
      case 'nip07':
        userPublicKey = await window.nostr.getPublicKey();
        break;
      case 'localstorage':
        userPublicKey = getPublicKeyFromLocalstorage();
        break;
      default:
        userPublicKey = this.publicKey;
    }
    if (!userPublicKey) {
      throw new Error('No public key found');
    }
    this.relayPool
      .sub(this.relays, [
        { kinds: [4, 7000], authors: [userPublicKey], '#p': [this.agentKey] },
        { kinds: [4, 7000], authors: [this.agentKey], '#p': [userPublicKey] },
      ])
      .on('event', async (e) => {
        if (e.kind === 7000 && listeners.onProcessing) {
          listeners.onProcessing();
        } else if (e.kind === 4) {
          const invoice = getTagValue(e, 'invoice', 1);
          if (invoice) {
            if (this.useWebLn) {
              try {
                handleWebLnPayment(invoice);
              } catch (paymentErr) {
                if (!listeners.onInvoice) {
                  throw new Error(
                    'WebLN failed and there was no invoice callback to fallback to.',
                  );
                }
                listeners.onInvoice(invoice);
              }
            } else {
              // eslint-disable-next-line no-lonely-if
              if (listeners.onInvoice) {
                listeners.onInvoice(invoice);
              }
            }
          } else {
            const decryptedMessage = await this.decryptMessage(
              this.agentKey,
              e.content,
            );
            listeners.onMessage(e as Event<4>, decryptedMessage);
          }
        }
      });
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
    if (this.secretKeyMethod === 'localstorage') {
      return signFromLocalstorage(unsignedEvent);
    }
    throw new Error('No valid private key available');
  }

  async sendPrompt(prompt: string) {
    const event = await this.createKind4(prompt);
    const pubs = this.relayPool.publish(this.relays, event);
    return pubs;
  }
}

export default Conversation;
