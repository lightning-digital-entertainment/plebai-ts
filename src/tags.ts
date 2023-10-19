/* eslint-disable import/prefer-default-export */
import { Event } from 'nostr-tools';

export function getTagValue(
  event: Event,
  tagIdentifier: string,
  valueIndex: number = 1
) {
  const tag = event.tags.find((t) => t[0] === tagIdentifier);
  if (!tag) {
    return undefined;
  }
  return tag[valueIndex];
}
