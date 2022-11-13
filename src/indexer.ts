import { MemoryStore, MerkleTree, SparseMerkleTree } from 'snarky-smt';
import { Encoding, Experimental, Field } from 'snarkyjs';
import {
  INITIAL_ACCOUNTS_ROOT,
  INITIAL_RECORDS_INDEX,
  INITIAL_RECORDS_ROOT,
  RECORDS_TREE_HEIGHT,
} from './constant';
import { MansZkapp } from './mans_zkapp';
import { MansAccount } from './models/account';
import { Action } from './models/action';
import { ActionBatch } from './models/action_batch';
import { Record } from './models/record';
import { MansRollupProverServerHelper } from './prover_helper';
import { MansRollupProof, MansRollupProver } from './rollup_prover';

export {
  indexerState,
  getAccountFromIndexer,
  getRecordFromIndexer,
  runRollupProveAndUpdateIndexer,
};

let indexerState = {
  lastProcessedRecordIndex: INITIAL_RECORDS_INDEX,
  lastProcessedActionsHash: Experimental.Reducer.initialActionsHash,
  currentAccountsRoot: INITIAL_ACCOUNTS_ROOT,
  currentRecordsRoot: INITIAL_RECORDS_ROOT,
};

let recordsTree = await MerkleTree.build<Record>(
  new MemoryStore(),
  RECORDS_TREE_HEIGHT
);
let accountsTree = await SparseMerkleTree.build<Field, MansAccount>(
  new MemoryStore(),
  { hashKey: false }
);

async function getAccountFromIndexer(name: string): Promise<MansAccount> {
  let fs = Encoding.Bijective.Fp.fromString(name);
  let account = await accountsTree.get(fs[0]);
  return account!;
}

async function getRecordFromIndexer(index: bigint): Promise<Record> {
  let record = await recordsTree.get(index);
  return record!;
}

function getPendingActions(
  zkapp: MansZkapp,
  fromActionHash: Field,
  endActionHash?: Field
): Action[] {
  let pendingActions = zkapp.reducer.getActions({
    fromActionHash,
    endActionHash,
  });
  let actions: Action[] = [];

  for (let i = 0, len = pendingActions.length; i < len; i++) {
    let actionList = pendingActions[i];
    for (let j = 0, acLen = actionList.length; j < acLen; j++) {
      let action = actionList[j];
      actions.push(action);
    }
  }

  return actions;
}

async function runRollupProveAndUpdateIndexer(
  zkapp: MansZkapp
): Promise<MansRollupProof | null> {
  console.log('run rollup batch prove start');
  console.time('batch_prove');

  let currState = zkapp.state.get();
  let currentActionsHash = currState.currentActionsHash;
  let pendingActions = getPendingActions(zkapp, currentActionsHash);

  if (pendingActions.length === 0) {
    return null;
  }

  let batchNum = pendingActions.length / ActionBatch.batchSize;
  let restActionsNum = pendingActions.length % ActionBatch.batchSize;

  let proofs: MansRollupProof[] = [];

  let curPos = 0;
  for (let i = 0; i < batchNum; i++) {
    let currentActions = pendingActions.slice(
      curPos,
      curPos + ActionBatch.batchSize
    );
    curPos = curPos + ActionBatch.batchSize;

    let { stateTransition, actionBatch } =
      await MansRollupProverServerHelper.commitActionBatch(
        currentActions,
        currState,
        accountsTree,
        recordsTree
      );

    console.log('stateTransition: ', stateTransition.toJSON());

    console.time('generate commitActionBatch proof');
    let currProof = await MansRollupProver.commitActionBatch(
      stateTransition,
      actionBatch
    );
    console.timeEnd('generate commitActionBatch proof');

    proofs.push(currProof);
    currState = stateTransition.target;
  }

  // process rest actions
  if (restActionsNum > 0) {
    console.log('process rest actions');
    let { stateTransition, actionBatch } =
      await MansRollupProverServerHelper.commitActionBatch(
        pendingActions.slice(curPos, curPos + restActionsNum),
        currState,
        accountsTree,
        recordsTree
      );

    console.log('stateTransition: ', stateTransition.toJSON());

    console.time('generate commitActionBatch proof');
    let currProof = await MansRollupProver.commitActionBatch(
      stateTransition,
      actionBatch
    );
    console.timeEnd('generate commitActionBatch proof');

    proofs.push(currProof);
  }

  let mergedProof = proofs[0];
  if (proofs.length > 1) {
    for (let i = 1, len = proofs.length; i < len; i++) {
      let p1 = mergedProof;
      let p2 = proofs[i];
      let stateTransition = MansRollupProverServerHelper.merge(p1, p2);
      console.time('generate merged proof');
      mergedProof = await MansRollupProver.merge(stateTransition, p1, p2);
      console.timeEnd('generate merged proof');
    }
  }

  console.timeEnd('batch_prove');
  console.log('run rollup batch prove end');

  indexerState.currentAccountsRoot = accountsTree.getRoot();
  indexerState.currentRecordsRoot = recordsTree.getRoot();
  indexerState.lastProcessedActionsHash =
    mergedProof.publicInput.target.currentActionsHash;
  indexerState.lastProcessedRecordIndex =
    mergedProof.publicInput.target.currentRecordIndex;
  return mergedProof;
}
