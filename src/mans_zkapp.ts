import {
  createEmptyValue,
  DeepSparseMerkleSubTree,
  SMT_EMPTY_VALUE,
  SparseMerkleProof,
  SparseMerkleTree,
  verifyProofByFieldInCircuit,
} from 'snarky-smt';
import {
  AccountUpdate,
  Bool,
  Circuit,
  Experimental,
  Field,
  isReady,
  method,
  Mina,
  Permissions,
  Poseidon,
  PrivateKey,
  PublicKey,
  shutdown,
  SmartContract,
  State,
  state,
  UInt64,
} from 'snarkyjs';
import { MansAccount } from './models/account';
import { AccountWithProof, RecordWithProof } from './models/account_with_proof';
import {
  Action,
  ACTION_TYPE_REGISTER,
  ACTION_TYPE_UPDATE_ACCOUNT,
} from './models/action';
import { OwnerSecretWithPublicKey } from './models/owner_secret';
import {
  Permit,
  PERMIT_UPDATE_MANSACCOUNT,
  PERMIT_UPDATE_MANSRECORD,
  PERMIT_UPDATE_OWNER,
  PERMIT_UPDATE_REGISTER_FEE,
} from './models/permit';
import { Record, RecordKey } from './models/record';

await isReady;

const doProofs = true;
const initialAccountsCommitment = SparseMerkleTree.initialPoseidonHashRoot;
const initialRecordsCommitment = SparseMerkleTree.initialPoseidonHashRoot;
const registerFee = UInt64.fromNumber(10_000);

export class MansZkapp extends SmartContract {
  @state(Field) accountsCommitment = State<Field>();
  @state(Field) recordsCommitment = State<Field>();
  @state(UInt64) registerFee = State<UInt64>();
  @state(PublicKey) owner = State<PublicKey>();

  @state(Field) actionsHash = State<Field>();

  reducer = Experimental.Reducer({ actionType: Action });

  accountProofStore: Map<string, AccountWithProof>;
  recordProofStore: Map<string, RecordWithProof>;

  setAccountProofStore(accountProofStore: Map<string, AccountWithProof>) {
    this.accountProofStore = accountProofStore;
  }

  setRecordProofStore(recordProofStore: Map<string, RecordWithProof>) {
    this.recordProofStore = recordProofStore;
  }

  deploy(args: {
    verificationKey?:
      | {
          data: string;
          hash: string | Field;
        }
      | undefined;
    zkappKey?: PrivateKey | undefined;
    ownerPublicKey: PublicKey;
    doProofs: boolean;
  }) {
    super.deploy(args);

    if (!args.doProofs) {
      this.setPermissions({
        ...Permissions.default(),
        editState: Permissions.proofOrSignature(),
        editSequenceState: Permissions.proofOrSignature(),
        send: Permissions.proofOrSignature(),
        receive: Permissions.proofOrSignature(),
      });
    }

    this.accountsCommitment.set(initialAccountsCommitment);
    this.recordsCommitment.set(initialRecordsCommitment);

    this.registerFee.set(registerFee);
    this.owner.set(args.ownerPublicKey);
    this.actionsHash.set(Experimental.Reducer.initialActionsHash);
  }

  @method
  updateRegisterFee(fee: UInt64, ownerPermit: Permit) {
    const owner = this.owner.get();
    this.owner.assertEquals(owner);

    ownerPermit.permitData.permitType.assertEquals(PERMIT_UPDATE_REGISTER_FEE);
    ownerPermit.permitData.data.assertEquals(fee.value);
    ownerPermit.verify(owner).assertTrue();
    this.registerFee.set(fee);
  }

  @method
  updateZkappOwner(newOwner: PublicKey, oldOwnerPermit: Permit) {
    const owner = this.owner.get();
    this.owner.assertEquals(owner);

    oldOwnerPermit.permitData.permitType.assertEquals(PERMIT_UPDATE_OWNER);
    oldOwnerPermit.permitData.data.assertEquals(
      Poseidon.hash(newOwner.toFields())
    );
    oldOwnerPermit.verify(owner).assertTrue();

    this.owner.set(newOwner);
  }

  @method
  registerAccount(account: MansAccount) {
    this.reducer.dispatch(Action.registerAccount(account));
  }

  @method
  updateAccount(
    newAccount: MansAccount,
    operatingAccount: MansAccount,
    ownerSecret: OwnerSecretWithPublicKey,
    permit: Permit
  ) {
    newAccount.name.assertEquals(operatingAccount.name);
    operatingAccount.ownerSecretHash.assertEquals(
      Poseidon.hash(ownerSecret.sign.toFields())
    );

    ownerSecret.sign
      .verify(ownerSecret.publicKey, ownerSecret.publicKey.toFields())
      .assertTrue();
    permit.permitData.permitType.assertEquals(PERMIT_UPDATE_MANSACCOUNT);
    permit.permitData.data.assertEquals(newAccount.hash());
    permit.verify(ownerSecret.publicKey).assertTrue();

    this.reducer.dispatch(Action.updateAccount(newAccount, operatingAccount));
  }

  @method
  updateRecord(
    record: Record,
    operatingAccount: MansAccount,
    ownerSecret: OwnerSecretWithPublicKey,
    permit: Permit
  ) {
    record.account.assertEquals(operatingAccount.name);
    operatingAccount.ownerSecretHash.assertEquals(
      Poseidon.hash(ownerSecret.sign.toFields())
    );

    ownerSecret.sign
      .verify(ownerSecret.publicKey, ownerSecret.publicKey.toFields())
      .assertTrue();
    permit.permitData.permitType.assertEquals(PERMIT_UPDATE_MANSRECORD);
    permit.permitData.data.assertEquals(record.hash());
    permit.verify(ownerSecret.publicKey).assertTrue();

    this.reducer.dispatch(Action.updateRecord(record, operatingAccount));
  }

  @method
  rollup() {
    let accountsCommitment = this.accountsCommitment.get();
    this.accountsCommitment.assertEquals(accountsCommitment);

    let recordsCommitment = this.recordsCommitment.get();
    this.recordsCommitment.assertEquals(recordsCommitment);

    let actionsHash = this.actionsHash.get();
    this.actionsHash.assertEquals(actionsHash);

    let pendingActions = this.reducer.getActions({
      fromActionHash: actionsHash,
    });

    let actions: Action[] = [];
    let { actionsHash: newActionsHash } = this.reducer.reduce(
      pendingActions,
      Field,
      (state: Field, action: Action) => {
        actions.push(action);
        return state;
      },
      // initial state
      { state: Field.zero, actionsHash }
    );
    this.actionsHash.set(newActionsHash);

    let accountsSubTree = new DeepSparseMerkleSubTree<Field, MansAccount>(
      accountsCommitment,
      MansAccount
    );
    let recordsSubTree = new DeepSparseMerkleSubTree<RecordKey, Record>(
      recordsCommitment,
      Record
    );

    Circuit.asProver(() => {
      for (let i = 0; i < actions.length; i++) {
        let action = actions[i];
        if (action.type.equals(ACTION_TYPE_REGISTER).toBoolean()) {
          let accountName = action.accountUpdate.name;
          let merkleProof = Circuit.witness(SparseMerkleProof, () => {
            let accountWithProof = this.accountProofStore.get(
              accountName.toString()
            )!;
            return accountWithProof.merkleProof;
          });
          accountsSubTree.addBranch(
            merkleProof,
            accountName,
            createEmptyValue(MansAccount)
          );
        } else if (action.type.equals(ACTION_TYPE_UPDATE_ACCOUNT).toBoolean()) {
          let accountName = action.accountUpdate.name;
          let accountWithProof = Circuit.witness(AccountWithProof, () => {
            let accountWithProof = this.accountProofStore.get(
              accountName.toString()
            )!;
            return accountWithProof;
          });
          accountsSubTree.addBranch(
            accountWithProof.merkleProof,
            accountName,
            accountWithProof.account
          );
        } else {
          let record = action.recordUpdate;
          let recordKey = new RecordKey(
            record.account,
            record.key,
            record.kind,
            record.label
          );
          let recordWithProof = Circuit.witness(RecordWithProof, () => {
            let recordWithProof = this.recordProofStore.get(
              recordKey.hash().toString()
            )!;
            return recordWithProof;
          });
          recordsSubTree.addBranch(
            recordWithProof.merkleProof,
            recordKey,
            recordWithProof.record
          );
        }
      }
    });

    for (let i = 0; i < actions.length; i++) {
      let action = actions[i];
      this.reduceAccount(accountsCommitment, action, accountsSubTree);
      this.reduceRecord(recordsCommitment, action, recordsSubTree);
    }

    let finalAccountsCommitment = accountsSubTree.getRoot();
    let finalRecordsCommitment = recordsSubTree.getRoot();

    this.accountsCommitment.set(finalAccountsCommitment);
    this.recordsCommitment.set(finalRecordsCommitment);
  }

  reduceAccount(
    commitment: Field,
    action: Action,
    subTree: DeepSparseMerkleSubTree<Field, MansAccount>
  ) {
    // check operationg account
    let operatingAccount = action.operatingAccount;
    let accountUpdate = action.accountUpdate;
    let membershipProof = Circuit.witness(SparseMerkleProof, () => {
      let accountWithProof = this.accountProofStore.get(
        operatingAccount.name.toString()
      )!;
      return accountWithProof.merkleProof;
    });
    let isMember = verifyProofByFieldInCircuit(
      membershipProof,
      commitment,
      Poseidon.hash(operatingAccount.name.toFields()),
      operatingAccount.hash()
    );

    let nonExist = verifyProofByFieldInCircuit(
      membershipProof,
      commitment,
      Poseidon.hash(accountUpdate.name.toFields()),
      SMT_EMPTY_VALUE
    );

    let acc = Circuit.if(
      isMember.or(nonExist),
      accountUpdate,
      MansAccount.empty()
    );

    subTree.update(accountUpdate.name, acc);
  }

  reduceRecord(
    commitment: Field,
    action: Action,
    subTree: DeepSparseMerkleSubTree<RecordKey, Record>
  ) {
    // check operationg account
    let operatingAccount = action.operatingAccount;
    let recordUpdate = action.recordUpdate;
    let membershipProof = Circuit.witness(SparseMerkleProof, () => {
      let accountWithProof = this.accountProofStore.get(
        operatingAccount.name.toString()
      )!;
      return accountWithProof.merkleProof;
    });
    let isMember = verifyProofByFieldInCircuit(
      membershipProof,
      commitment,
      Poseidon.hash(operatingAccount.name.toFields()),
      operatingAccount.hash()
    );

    let record = Circuit.if(isMember, recordUpdate, Record.empty());
    let recordKey = new RecordKey(
      record.account,
      record.key,
      record.kind,
      record.label
    );

    subTree.update(recordKey, record);
  }
}

let local = Mina.LocalBlockchain();
Mina.setActiveInstance(local);
let feePayerKey = local.testAccounts[0].privateKey;
let callerKey = local.testAccounts[1].privateKey;
let callerPublicKey = callerKey.toPublicKey();
let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

async function test() {
  let zkapp = new MansZkapp(zkappAddress);

  if (doProofs) {
    console.log('start compiling');
    console.time('compile');
    await MansZkapp.compile();
    console.timeEnd('compile');
  }

  console.log('deploying');
  let tx = await local.transaction(feePayerKey, () => {
    AccountUpdate.fundNewAccount(feePayerKey);
    zkapp.deploy({ zkappKey, ownerPublicKey: callerPublicKey, doProofs });
  });
  if (doProofs) {
    await tx.prove();
    tx.send();
  } else {
    tx.send();
  }

  console.log('deploy done');

  shutdown();
}

await test();
