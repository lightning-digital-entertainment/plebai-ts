# plebai-ts

A TS/JS wrapper for communicating with plebAI agents through nostr.

Depends on the _@nostr-tools_ package.

This package is a work-in-progress and its API might still change over time.

## Usage

```js
import { Conversation } from 'pleb-ai';

// Instantiate a Conversation, passing the agents Publickey, a list of relays that you want to use for communication, and a config object.
const conv = new Conversation('<Agent PublicKey>', ['<List of Relays>'], {
  secretKeyMethod: 'nip07',
});

// create a subscription to receive all messages that are sent between you and the agent
conv.sub((e) => {
  console.log(e);
});

// send a prompt to the agent
conv.sendPrompt('Write a text about artificial intelligence');
```

### Config Object

- useWebLN: Boolean wether WebLN should be used automatically to pay invoices. (Defaults to false)
- secretKeyMethod (Defaults to throwaway)
  - nip07: Attempt to call a nip07 provider. 
  - throwaway: create a new key for the conversation and save it in memory
  - localstorage: look for a private key in localstorage, if there is none create it
- providerHost: Hostname of plebai provider. (Defaults to https://plebai.com)

```ts
type ConversationConfig = {
  useWebLn: boolean;
  secretKeyMethod: 'nip07' | 'throwaway' | 'localstorage';
  providerHost: string;
};
```