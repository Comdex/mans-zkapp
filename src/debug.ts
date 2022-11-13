import { isReady, PrivateKey } from 'snarkyjs';

await isReady;

let priKey = PrivateKey.random();
let pubKey = priKey.toPublicKey();

console.log('priKey: ', priKey.toBase58());
console.log('pubKey: ', pubKey.toBase58());
