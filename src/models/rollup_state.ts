import { CircuitValue, Field, isReady, Poseidon, prop } from 'snarkyjs';

await isReady;

export { RollupState };

class RollupState extends CircuitValue {
  @prop accountsRoot: Field;
  @prop currentRecordIndex: Field;
  @prop recordsRoot: Field;
  @prop currentActionsHash: Field;

  constructor(
    accountsRoot: Field,
    currentRecordIndex: Field,
    recordsRoot: Field,
    currentActionsHash: Field
  ) {
    super();
    this.accountsRoot = accountsRoot;
    this.currentRecordIndex = currentRecordIndex;
    this.recordsRoot = recordsRoot;
    this.currentActionsHash = currentActionsHash;
  }

  static from(state: {
    accountsRoot: Field;
    currentRecordIndex: Field;
    recordsRoot: Field;
    currentActionsHash: Field;
  }) {
    return new this(
      state.accountsRoot,
      state.currentRecordIndex,
      state.recordsRoot,
      state.currentActionsHash
    );
  }

  hash(): Field {
    return Poseidon.hash(this.toFields());
  }

  toPretty(): any {
    return {
      accountsRoot: this.accountsRoot.toString(),
      currentRecordIndex: this.currentRecordIndex.toString(),
      recordsRoot: this.recordsRoot.toString(),
      currentActionsHash: this.currentActionsHash.toString(),
    };
  }
}
