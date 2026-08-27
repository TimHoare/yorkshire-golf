import { useSyncExternalStore } from 'react';
import { subscribe, getSnapshot, type Snapshot } from './store';

export function useStore(): Snapshot {
  return useSyncExternalStore(subscribe, getSnapshot);
}
