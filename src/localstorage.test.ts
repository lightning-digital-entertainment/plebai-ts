import {
  describe,
  test,
  expect,
  afterEach
} from '@jest/globals';
import { EventTemplate, generatePrivateKey } from 'nostr-tools';
import {
  getPublicKeyFromLocalstorage,
  signFromLocalstorage,
} from './localstorage';

class LocalStorageMock {
  store: {
    [key: string]: string;
  };

  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key: string) {
    return this.store[key] || null;
  }

  setItem(key: string, value: string) {
    this.store[key] = String(value);
  }

  removeItem(key: string) {
    delete this.store[key];
  }
}

// @ts-ignore
global.localStorage = new LocalStorageMock();

describe('signing a message from localstorage', () => {
  afterEach(() => {
    localStorage.removeItem('pleb_sk');
  });
  test('assume private key is found', () => {
    localStorage.setItem('pleb_sk', generatePrivateKey());
    const unsignedEvent: EventTemplate = {
      created_at: Math.floor(Date.now() / 1000),
      content: 'Event content',
      kind: 1,
      tags: [],
    };
    const signedEvent = signFromLocalstorage(unsignedEvent);
    expect(signedEvent.sig).toBeTruthy();
  });

  test('assume no private key is found', () => {
    const unsignedEvent: EventTemplate = {
      created_at: Math.floor(Date.now() / 1000),
      content: 'Event content',
      kind: 1,
      tags: [],
    };
    expect(() => {
      signFromLocalstorage(unsignedEvent);
    }).toThrow();
  });
});

describe('getting public key from local storage', () => {
  afterEach(() => {
    localStorage.removeItem('pleb_sk');
  });
  test('assume private key is found', () => {
    localStorage.setItem('pleb_sk', generatePrivateKey());
    const publicKey = getPublicKeyFromLocalstorage();
    expect(publicKey).toBeTruthy();
  });
  test('assume no private key is found', () => {
    expect(() => {
      getPublicKeyFromLocalstorage();
    }).toThrow();
  });
});
