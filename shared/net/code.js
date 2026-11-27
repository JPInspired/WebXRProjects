/**
 * A class code that is easy to read out loud (no 0/O, 1/I/L): six characters from the browser's secure random
 * numbers, so nobody can guess their way into a class (31^6, about 887 million codes).
 */
export function newSessionCode() {
  const A = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const r = new Uint32Array(6);
  crypto.getRandomValues(r);
  let c = '';
  for (const n of r) c += A[n % A.length];
  return c;
}
