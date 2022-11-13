import {
  ProvableMerkleTreeUtils,
  ProvableSMTUtils,
  SparseMerkleProof,
} from 'snarky-smt';
import {
  AccountUpdate,
  Circuit,
  CircuitValue,
  Experimental,
  Field,
  prop,
  SelfProof,
} from 'snarkyjs';
import { Action } from './models/action';
import { ActionBatch, RecordProof } from './models/action_batch';
import { RollupStateTransition } from './models/rollup_state_transition';
import { circuitLog } from './utils';

export { MansRollupProver, MansRollupProof };

class MansState extends CircuitValue {
  @prop currAccountsRoot: Field;
  @prop currRecordsRoot: Field;
  @prop currRecordIndex: Field;

  constructor(
    currAccountsRoot: Field,
    currRecordsRoot: Field,
    currRecordIndex: Field
  ) {
    super();
    this.currAccountsRoot = currAccountsRoot;
    this.currRecordsRoot = currRecordsRoot;
    this.currRecordIndex = currRecordIndex;
  }
}

function processUpdateAccount(currState: {
  currAction: Action;
  currAccountProof: SparseMerkleProof;
  currAccountsRoot: Field;
  currRecordsRoot: Field;
  currRecordIndex: Field;
}): MansState {
  let {
    currAction,
    currAccountProof,
    currAccountsRoot,
    currRecordsRoot,
    currRecordIndex,
  } = currState;

  let account = currAction.getAccount();
  let proofValid = Circuit.if(
    currAction.isRegisterAccount(),
    // register account
    ProvableSMTUtils.checkNonMembership(
      currAccountProof,
      currAccountsRoot,
      account.name,
      { hashKey: false }
    ),
    // update account
    ProvableSMTUtils.checkMembership(
      currAccountProof,
      currAccountsRoot,
      account.name,
      currAction.originalHash,
      { hashKey: false, hashValue: false }
    )
  );

  currAccountsRoot = Circuit.if(
    proofValid,
    ProvableSMTUtils.computeRoot(
      currAccountProof.sideNodes,
      account.name,
      account,
      { hashKey: false, hashValue: true }
    ),
    currAccountsRoot
  );

  return new MansState(currAccountsRoot, currRecordsRoot, currRecordIndex);
}

function processAddRecord(currState: {
  currAction: Action;
  currAccountProof: SparseMerkleProof;
  currAccountsRoot: Field;
  currRecordProof: RecordProof;
  currRecordsRoot: Field;
  currRecordIndex: Field;
}): MansState {
  let {
    currAction,
    currAccountProof,
    currAccountsRoot,
    currRecordProof,
    currRecordsRoot,
    currRecordIndex,
  } = currState;

  let record = currAction.getRecord();

  let checkPermission = ProvableSMTUtils.checkMembership(
    currAccountProof,
    currAccountsRoot,
    record.accountName,
    currAction.operatingAccountHash,
    { hashKey: false, hashValue: false }
  );
  currRecordIndex = currRecordIndex.add(1);
  let noMembership = ProvableMerkleTreeUtils.checkNonMembership(
    currRecordProof,
    currRecordsRoot,
    currRecordIndex
  );

  currRecordsRoot = Circuit.if(
    checkPermission.and(noMembership),
    ProvableMerkleTreeUtils.computeRoot(
      currRecordProof,
      currRecordIndex,
      record
    ),
    currRecordsRoot
  );

  return new MansState(currAccountsRoot, currRecordsRoot, currRecordIndex);
}

function processUpdateRecord(currState: {
  currAction: Action;
  currAccountProof: SparseMerkleProof;
  currAccountsRoot: Field;
  currRecordProof: RecordProof;
  currRecordsRoot: Field;
  currRecordIndex: Field;
}): MansState {
  let {
    currAction,
    currAccountProof,
    currAccountsRoot,
    currRecordProof,
    currRecordsRoot,
    currRecordIndex,
  } = currState;

  let record = currAction.getRecord();

  let checkPermission = ProvableSMTUtils.checkMembership(
    currAccountProof,
    currAccountsRoot,
    record.accountName,
    currAction.operatingAccountHash,
    { hashKey: false, hashValue: false }
  );
  circuitLog('check permission ok');

  let membership = ProvableMerkleTreeUtils.checkMembership(
    currRecordProof,
    currRecordsRoot,
    record.index,
    currAction.originalHash,
    { hashValue: false }
  );

  circuitLog('check membership ok');

  currRecordsRoot = Circuit.if(
    checkPermission.and(membership),
    Circuit.if(
      currAction.isUpdateRecord(),
      ProvableMerkleTreeUtils.computeRoot(
        currRecordProof,
        record.index,
        record
      ),
      ProvableMerkleTreeUtils.computeRoot(
        currRecordProof,
        record.index,
        ProvableMerkleTreeUtils.EMPTY_VALUE,
        { hashValue: false }
      )
    ),
    currRecordsRoot
  );

  return new MansState(currAccountsRoot, currRecordsRoot, currRecordIndex);
}

let MansRollupProver = Experimental.ZkProgram({
  publicInput: RollupStateTransition,

  methods: {
    commitActionBatch: {
      privateInputs: [ActionBatch],

      method(stateTransition: RollupStateTransition, actionBatch: ActionBatch) {
        let currState = new MansState(
          stateTransition.source.accountsRoot,
          stateTransition.source.recordsRoot,
          stateTransition.source.currentRecordIndex
        );
        let currActionsHash = stateTransition.source.currentActionsHash;

        let afterState = new MansState(
          stateTransition.target.accountsRoot,
          stateTransition.target.recordsRoot,
          stateTransition.target.currentRecordIndex
        );
        let afterCurrActionsHash = stateTransition.target.currentActionsHash;

        for (let i = 0, len = ActionBatch.batchSize; i < len; i++) {
          let currAction = actionBatch.actions[i];
          let currRecordProof = actionBatch.recordProofs[i];
          let currAccountProof = actionBatch.accountProofs[i];

          let eventHash = AccountUpdate.SequenceEvents.hash([
            currAction.toFields(),
          ]);
          currActionsHash = Circuit.if(
            currAction.isDummyData(),
            currActionsHash,
            AccountUpdate.SequenceEvents.updateSequenceState(
              currActionsHash,
              eventHash
            )
          );
          circuitLog('currActionsHash calc end');

          let { currAccountsRoot, currRecordsRoot, currRecordIndex } =
            currState;

          let afterUpdateAccount = processUpdateAccount({
            currAction,
            currAccountProof,
            currAccountsRoot,
            currRecordsRoot,
            currRecordIndex,
          });
          circuitLog('afterUpdateAccount end');

          let afterAddRecord = processAddRecord({
            currAction,
            currAccountProof,
            currAccountsRoot,
            currRecordProof,
            currRecordsRoot,
            currRecordIndex,
          });
          circuitLog('afterAddRecord end');

          let afterUpdateRecord = processUpdateRecord({
            currAction,
            currAccountProof,
            currAccountsRoot,
            currRecordProof,
            currRecordsRoot,
            currRecordIndex,
          });
          circuitLog('afterUpdateRecord end');

          currState = Circuit.switch(
            [
              currAction.isRegisterAccount().or(currAction.isUpdateAccount()),
              currAction.isAddRecord(),
              currAction.isUpdateRecord().or(currAction.isDelRecord()),
              currAction.isDummyData(),
            ],
            MansState,
            [afterUpdateAccount, afterAddRecord, afterUpdateRecord, currState]
          );
          circuitLog('switch currState end');
        }

        currActionsHash.assertEquals(afterCurrActionsHash);
        circuitLog('currActionsHash assert success: ', currActionsHash);

        currState.assertEquals(afterState);
        circuitLog('currState assert success: ', currState);
      },
    },

    merge: {
      privateInputs: [SelfProof, SelfProof],

      method(
        stateTransition: RollupStateTransition,
        p1: SelfProof<RollupStateTransition>,
        p2: SelfProof<RollupStateTransition>
      ) {
        p1.verify();
        p2.verify();

        p1.publicInput.source.assertEquals(stateTransition.source);
        p1.publicInput.target.assertEquals(p2.publicInput.source);
        p2.publicInput.target.assertEquals(stateTransition.target);
      },
    },
  },
});

class MansRollupProof extends Experimental.ZkProgram.Proof(MansRollupProver) {}
