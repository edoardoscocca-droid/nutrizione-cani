// Funzioni del browser usate dal codice condiviso che su iPhone potrebbero mancare.
import 'react-native-url-polyfill/auto';

const g = globalThis as unknown as { structuredClone?: <T>(v: T) => T };
if (typeof g.structuredClone !== 'function') {
  // i dati dell'app sono JSON puro (niente date o funzioni): la copia via JSON è fedele
  g.structuredClone = <T,>(v: T): T => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
}
