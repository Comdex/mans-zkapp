import { SparseMerkleProof } from 'snarky-smt';
import { CircuitValue, isReady, prop } from 'snarkyjs';
import { MansAccount } from './account';
import { Record } from './record';

await isReady;

export class AccountWithProof extends CircuitValue {
  @prop account: MansAccount;
  @prop merkleProof: SparseMerkleProof;

  constructor(account: MansAccount, merkleProof: SparseMerkleProof) {
    super();
    this.account = account;
    this.merkleProof = merkleProof;
  }
}

export class RecordWithProof extends CircuitValue {
  @prop record: Record;
  @prop merkleProof: SparseMerkleProof;

  constructor(record: Record, merkleProof: SparseMerkleProof) {
    super();
    this.record = record;
    this.merkleProof = merkleProof;
  }
}
