// Share initialization only; do not retry requests or reinterpret provider denials.
export function readyPort<T>(connect: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () =>
    (pending ??= connect().catch((error) => {
      pending = undefined;
      throw error;
    }));
}
