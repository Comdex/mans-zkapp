import {
  createEmptyValue,
  MerkleTree,
  SparseMerkleProof,
  SparseMerkleTree,
} from 'snarky-smt';
import { AccountUpdate, Field, SelfProof } from 'snarkyjs';
import { MansAccount } from './models/account';
import { Action } from './models/action';
import { ActionBatch, RecordProof } from './models/action_batch';
import { Record } from './models/record';
import { RollupState } from './models/rollup_state';
import { RollupStateTransition } from './models/rollup_state_transition';

export { MansRollupProverServerHelper };

let MansRollupProverServerHelper = {
  async commitActionBatch(
    actions: Action[],
    currState: RollupState,
    accountsTree: SparseMerkleTree<Field, MansAccount>,
    recordsTree: MerkleTree<Record>
  ): Promise<{
    stateTransition: RollupStateTransition;
    actionBatch: ActionBatch;
  }> {
    if (actions.length > ActionBatch.batchSize) {
      throw new Error(
        `Actions exceeding a fixed batch size of ${ActionBatch.batchSize} cannot be processed`
      );
    }

    let currentActionsHash = currState.currentActionsHash;
    let currentRecordIndex = currState.currentRecordIndex;
    let accountProofs: SparseMerkleProof[] = [];
    let recordProofs: RecordProof[] = [];
    let emptyRecordProof = createEmptyValue(RecordProof);
    console.log('proof height: ', emptyRecordProof.height());
    let emptyAccountProof = createEmptyValue(SparseMerkleProof);

    for (let i = 0, len = actions.length; i < len; i++) {
      let currAction = actions[i];
      // compute new actions hash
      let eventHash = AccountUpdate.SequenceEvents.hash([
        currAction.toFields(),
      ]);
      currentActionsHash = AccountUpdate.SequenceEvents.updateSequenceState(
        currentActionsHash,
        eventHash
      );

      if (currAction.isRegisterAccount().toBoolean()) {
        let account = currAction.getAccount();
        let name = account.name;

        let proof = await accountsTree.prove(name);
        accountProofs.push(proof);
        recordProofs.push(emptyRecordProof);

        let exist = await accountsTree.has(name);
        if (!exist) {
          await accountsTree.update(name, account);
        }
      } else if (currAction.isUpdateAccount().toBoolean()) {
        let account = currAction.getAccount();
        let name = account.name;

        let proof = await accountsTree.prove(name);
        accountProofs.push(proof);
        recordProofs.push(emptyRecordProof);

        // check permission
        let oriValue = await accountsTree.get(name);
        if (
          oriValue !== null &&
          oriValue.hash().equals(currAction.originalHash).toBoolean()
        ) {
          await accountsTree.update(name, account);
        }
      } else if (currAction.isAddRecord().toBoolean()) {
        let record = currAction.getRecord();
        currentRecordIndex = currentRecordIndex.add(1);
        let currIndex = currentRecordIndex.toBigInt();

        let proof = await recordsTree.prove(currIndex);
        recordProofs.push(proof);
        accountProofs.push(emptyAccountProof);

        // check account permission
        let oriValue = await accountsTree.get(record.accountName);
        if (
          oriValue !== null &&
          oriValue.hash().equals(currAction.operatingAccountHash).toBoolean()
        ) {
          await recordsTree.update(currIndex, record);
        }
      } else {
        // update and del record

        let record = currAction.getRecord();
        let recordIndex = record.index.toBigInt();

        let proof = await recordsTree.prove(recordIndex);
        recordProofs.push(proof);
        accountProofs.push(emptyAccountProof);

        // check account permission and record permission
        let forAccount = await accountsTree.get(record.accountName);
        let forRecord = await recordsTree.get(recordIndex);
        if (
          forAccount !== null &&
          forAccount
            .hash()
            .equals(currAction.operatingAccountHash)
            .toBoolean() &&
          forRecord !== null &&
          forRecord.hash().equals(currAction.originalHash).toBoolean()
        ) {
          if (currAction.isUpdateRecord().toBoolean()) {
            await recordsTree.update(recordIndex, record);
          } else {
            await recordsTree.update(recordIndex);
          }
        }
      }
    }

    let dummyAction = Action.empty();
    let batchSize = ActionBatch.batchSize;
    let len = actions.length;
    actions.concat(Array(batchSize - len).fill(dummyAction));
    accountProofs.concat(Array(batchSize - len).fill(emptyAccountProof));
    recordProofs.concat(Array(batchSize - len).fill(emptyRecordProof));

    let actionBatch = new ActionBatch(actions, recordProofs, accountProofs);
    let recordsRoot = recordsTree.getRoot();
    let accountsRoot = accountsTree.getRoot();

    return {
      stateTransition: RollupStateTransition.from({
        source: currState,
        target: RollupState.from({
          currentActionsHash,
          currentRecordIndex,
          recordsRoot,
          accountsRoot,
        }),
      }),
      actionBatch,
    };
  },

  merge(
    p1: SelfProof<RollupStateTransition>,
    p2: SelfProof<RollupStateTransition>
  ): RollupStateTransition {
    let source = p1.publicInput.source;
    let target = p2.publicInput.target;

    return RollupStateTransition.from({ source, target });
  },
};
