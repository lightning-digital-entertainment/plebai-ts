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
  decryptMessage,
  decryptMessageFromLocalstorage,
  encryptMessage,
  encryptMessageFromLocalstorage,
} from './messages.js';
import { getTagValue } from './tags.js';
import { ConversationConfig, EncodedPublicKey, PublicKey } from './types.js';
import { handleWebLnPayment } from './webLn.js';

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
  }

  private async encryptMessage(
    receiverPublicKey: PublicKey,
    message: string
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
          'Throwaway key was selected as method, but none was set on class construction'
        );
      }
      return encryptMessage(receiverPublicKey, this.secretKey, message);
    }
    throw new Error('No valid private key Method was selected');
  }

  private async decryptMessage(
    senderPublicKey: PublicKey,
    message: string
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
          'Throwaway key was selected as method, but none was set on class construction'
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

  async sub(
    eventCallback: (e: Event<4>, decryptedMessage: string) => void,
    invoiceCallback?: (lightningInvoice: string) => void
  ) {
    if (!invoiceCallback && !this.useWebLn) {
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
        { kinds: [4], authors: [userPublicKey], '#p': [this.agentKey] },
        { kinds: [4], authors: [this.agentKey], '#p': [userPublicKey] },
      ])
      .on('event', async (e) => {
        const invoice = getTagValue(e, 'invoice', 1);
        if (invoice) {
          if (this.useWebLn) {
            try {
              handleWebLnPayment(invoice);
            } catch (paymentErr) {
              if (!invoiceCallback) {
                throw new Error(
                  'WebLN failed and there was no invoice callback to fallback to.'
                );
              }
              invoiceCallback(invoice);
            }
          } else {
            invoiceCallback!(invoice);
          }
        } else {
          const decryptedMessage = await this.decryptMessage(
            this.agentKey,
            e.content
          );
          eventCallback(e, decryptedMessage);
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
    throw new Error('No valid private key available');
  }

  async sendPrompt(prompt: string) {
    const event = await this.createKind4(prompt);
    const pubs = this.relayPool.publish(this.relays, event);
    return Promise.all(pubs);
  }
}

export default Conversation;
