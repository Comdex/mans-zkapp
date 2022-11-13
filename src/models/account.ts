import { createEmptyValue } from 'snarky-smt';
import {
  Bool,
  CircuitValue,
  Encoding,
  Field,
  isReady,
  Poseidon,
  prop,
  PublicKey,
  PrivateKey,
} from 'snarkyjs';
import { OwnerSecretCipherText } from './owner_secret';

await isReady;

export class MansAccount extends CircuitValue {
  @prop name: Field;
  @prop ownerSecret: OwnerSecretCipherText;
  @prop managerSecret: OwnerSecretCipherText;

  constructor(
    name: Field,
    ownerSecret: OwnerSecretCipherText,
    managerSecret: OwnerSecretCipherText
  ) {
    super();
    this.name = name;
    this.ownerSecret = ownerSecret;
    this.managerSecret = managerSecret;
  }

  static create(
    name: string,
    ownerPublicKey: PublicKey,
    managerPublicKey: PublicKey
  ): MansAccount {
    let fs = Encoding.Bijective.Fp.fromString(name);
    if (fs.length > 1) {
      throw new Error('name fields exceed limit: 1');
    }

    let ownerSecret = OwnerSecretCipherText.create(ownerPublicKey);
    let managerSecret = OwnerSecretCipherText.create(managerPublicKey);
    return new MansAccount(fs[0], ownerSecret, managerSecret);
  }

  changeOwner(ownerPublicKey: PublicKey): MansAccount {
    let ownerSecret = OwnerSecretCipherText.create(ownerPublicKey);

    return new MansAccount(this.name, ownerSecret, this.managerSecret.clone());
  }

  changeManager(managerPublicKey: PublicKey) {
    let managerSecret = OwnerSecretCipherText.create(managerPublicKey);

    return new MansAccount(this.name, this.ownerSecret.clone(), managerSecret);
  }

  checkOwner(ownerPrivateKey: PrivateKey): Bool {
    // mock
    return Bool(true);
    // return this.ownerSecret.checkOwner(ownerPrivateKey);
  }

  checkManager(managerPrivateKey: PrivateKey): Bool {
    // mock
    return managerPrivateKey.equals(managerPrivateKey);
    // return this.ownerSecret.checkOwner(ownerPrivateKey);
  }

  hash(): Field {
    return Poseidon.hash(this.toFields());
  }

  static empty(): MansAccount {
    return createEmptyValue(MansAccount);
  }
}
