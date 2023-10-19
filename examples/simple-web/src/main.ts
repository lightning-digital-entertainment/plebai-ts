import './style.css';
import { Conversation } from 'plebai-ts';

function messageCallback(e, m) {
  const imageSource = m;
  const imageContainer = document.getElementById('imageContainer');
  const image = document.createElement('img');
  image.src = imageSource;
  imageContainer?.appendChild(image);
}

const conv = new Conversation(
  '04f74530a6ede6b24731b976b8e78fb449ea61f40ff10e3d869a3030c4edc91f',
  [
    'wss://nos.lol',
    'wss://nostr21.com',
    'wss://offchain.pub',
    'wss://relay.plebstr.com',
  ],
  {
    secretKeyMethod: 'throwaway',
    useWebLn: true,
    providerHost: 'https://localhost.de',
  }
);
conv.sub(messageCallback);

const sendButton = document.getElementById('sendButton');
sendButton!.onclick = async () => {
  const textField = document.getElementById('promptField') as HTMLInputElement;
  const text = textField.value;
  try {
    conv.sendPrompt(text);
  } catch (e) {
    console.error(e);
  }
};
