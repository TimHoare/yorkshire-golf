// Tiny toast bus: fire-and-forget messages, one subscriber (the Toast component).
type Listener = (msg: string) => void;
let listener: Listener | null = null;
export function onToast(l: Listener) {
  listener = l;
  return () => { if (listener === l) listener = null; };
}
export function toast(msg: string) {
  listener?.(msg);
}
