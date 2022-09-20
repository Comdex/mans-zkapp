import { CircuitValue, Field, isReady, Poseidon, prop } from 'snarkyjs';

await isReady;

export class MansAccount extends CircuitValue {
  @prop name: Field;
  @prop ownerSecretHash: Field;
  @prop managerSecretHash: Field;

  constructor(name: Field, ownerSecretHash: Field, managerSecretHash: Field) {
    super();
    this.name = name;
    this.ownerSecretHash = ownerSecretHash;
    this.managerSecretHash = managerSecretHash;
  }

  hash(): Field {
    return Poseidon.hash(this.toFields());
  }

  static empty(): MansAccount {
    return new MansAccount(Field.zero, Field.zero, Field.zero);
  }
}
