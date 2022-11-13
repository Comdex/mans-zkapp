import { ProvableMerkleTreeUtils, SparseMerkleProof } from 'snarky-smt';
import { arrayProp, CircuitValue, isReady } from 'snarkyjs';
import { ACTION_BATCH_SIZE, RECORDS_TREE_HEIGHT } from '../constant';
import { Action } from './action';

await isReady;

export { RecordProof, ActionBatch };

class RecordProof extends ProvableMerkleTreeUtils.MerkleProof(
  RECORDS_TREE_HEIGHT
) {}

class ActionBatch extends CircuitValue {
  static batchSize = ACTION_BATCH_SIZE;

  @arrayProp(Action, ACTION_BATCH_SIZE) actions: Action[];
  @arrayProp(RecordProof, ACTION_BATCH_SIZE) recordProofs: RecordProof[];
  @arrayProp(SparseMerkleProof, ACTION_BATCH_SIZE)
  accountProofs: SparseMerkleProof[];

  constructor(
    actions: Action[],
    recordProofs: RecordProof[],
    accountProofs: SparseMerkleProof[]
  ) {
    super();
    this.actions = actions;
    this.recordProofs = recordProofs;
    this.accountProofs = accountProofs;
  }
}
