import {
  arrayProp,
  Bool,
  CircuitValue,
  Encryption,
  Field,
  Group,
  isReady,
  PrivateKey,
  prop,
  PublicKey,
} from 'snarkyjs';

await isReady;

export { OwnerSecret, OwnerSecretCipherText };

class OwnerSecret extends CircuitValue {
  @prop owner: PublicKey;
  @prop blinding: Field; //random number

  constructor(owner: PublicKey, blinding: Field) {
    super();
    this.owner = owner;
    this.blinding = blinding;
  }

  encrypt(): OwnerSecretCipherText {
    let newFields = this.toFields().slice();
    const cipherText = Encryption.encrypt(newFields, this.owner);
    return new OwnerSecretCipherText(
      cipherText.publicKey,
      cipherText.cipherText
    );
  }
}

const CIPHER_TEXT_LENGTH = OwnerSecret.sizeInFields() + 1;

class OwnerSecretCipherText extends CircuitValue {
  @prop publicKey: Group;
  @arrayProp(Field, CIPHER_TEXT_LENGTH) cipherText: Field[];

  constructor(publicKey: Group, cipherText: Field[]) {
    super();
    this.publicKey = publicKey;
    this.cipherText = cipherText;
  }

  static create(
    owner: PublicKey,
    blinding: Field = Field.random()
  ): OwnerSecretCipherText {
    return new OwnerSecret(owner, blinding).encrypt();
  }

  toPretty(): any {
    return {
      publicKey: this.publicKey.toString(),
      cipherText: this.cipherText.toString(),
    };
  }

  decrypt(ownerPrivateKey: PrivateKey): OwnerSecret {
    let newCipherText: Field[] = this.cipherText.slice();

    const decryptedFields = Encryption.decrypt(
      { publicKey: this.publicKey, cipherText: newCipherText },
      ownerPrivateKey
    );

    return OwnerSecret.ofFields(decryptedFields);
  }

  checkOwner(ownerPrivateKey: PrivateKey): Bool {
    const owner = ownerPrivateKey.toPublicKey();
    const ownerSecret = this.decrypt(ownerPrivateKey);
    return ownerSecret.owner.equals(owner);
  }

  clone(): OwnerSecretCipherText {
    let newCipherText = this.cipherText.slice();
    let newPublicKey = Group.ofFields([this.publicKey.x, this.publicKey.y]);

    return new OwnerSecretCipherText(newPublicKey, newCipherText);
  }
}
