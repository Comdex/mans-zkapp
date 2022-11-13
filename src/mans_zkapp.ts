import {
  AccountUpdate,
  DeployArgs,
  Experimental,
  isReady,
  method,
  Poseidon,
  PrivateKey,
  PublicKey,
  SmartContract,
  State,
  state,
  UInt64,
} from 'snarkyjs';
import {
  INITIAL_ACCOUNTS_ROOT,
  INITIAL_RECORDS_INDEX,
  INITIAL_RECORDS_ROOT,
  OWNER_PUBLICKEY,
  REGISTER_FEE,
} from './constant';
import { MansAccount } from './models/account';
import { Action } from './models/action';
import { Permit } from './models/permit';
import { Record } from './models/record';
import { RollupState } from './models/rollup_state';
import { MansRollupProof } from './rollup_prover';
import { circuitLog } from './utils';

await isReady;

export class MansZkapp extends SmartContract {
  @state(RollupState) state = State<RollupState>();

  @state(UInt64) registerFee = State<UInt64>();
  @state(PublicKey) owner = State<PublicKey>();

  reducer = Experimental.Reducer({ actionType: Action });

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.state.set(
      new RollupState(
        INITIAL_ACCOUNTS_ROOT,
        INITIAL_RECORDS_INDEX,
        INITIAL_RECORDS_ROOT,
        Experimental.Reducer.initialActionsHash
      )
    );
    this.registerFee.set(REGISTER_FEE);
    this.owner.set(OWNER_PUBLICKEY);
  }

  @method
  updateRegisterFee(fee: UInt64, ownerPermit: Permit) {
    const owner = this.owner.get();
    this.owner.assertEquals(owner);

    ownerPermit.forRegisterFee().assertTrue();
    ownerPermit.dataHash.assertEquals(Poseidon.hash(fee.toFields()));
    ownerPermit.verify(owner).assertTrue();

    this.registerFee.set(fee);
  }

  @method
  updateZkappOwner(newOwner: PublicKey, oldOwnerPermit: Permit) {
    const owner = this.owner.get();
    this.owner.assertEquals(owner);

    oldOwnerPermit.forUpdateOwner().assertTrue();
    oldOwnerPermit.dataHash.assertEquals(Poseidon.hash(newOwner.toFields()));
    oldOwnerPermit.verify(owner).assertTrue();

    this.owner.set(newOwner);
  }

  @method
  registerAccount(account: MansAccount, user: PrivateKey) {
    const registerFee = this.registerFee.get();
    this.registerFee.assertEquals(registerFee);

    let au = AccountUpdate.createSigned(user);
    au.send({ to: this.address, amount: registerFee });
    this.reducer.dispatch(Action.registerAccount(account));
  }

  @method
  updateAccount(
    newAccount: MansAccount,
    oldAccount: MansAccount,
    ownerPrivateKey: PrivateKey
  ) {
    newAccount.name.assertEquals(oldAccount.name);
    oldAccount.checkOwner(ownerPrivateKey).assertTrue();

    this.reducer.dispatch(Action.updateAccount(newAccount, oldAccount.hash()));
  }

  @method
  addRecord(
    record: Record,
    account: MansAccount,
    managerPrivateKey: PrivateKey
  ) {
    record.isAssignedIndex().assertFalse();
    record.accountName.assertEquals(account.name);
    account.checkManager(managerPrivateKey).assertTrue();

    this.reducer.dispatch(Action.addRecord(record, account.hash()));
  }

  @method
  updateRecord(
    newRecord: Record,
    oldRecord: Record,
    account: MansAccount,
    managerPrivateKey: PrivateKey
  ) {
    newRecord.accountName.assertEquals(oldRecord.accountName);
    circuitLog('record accountName assert success');
    newRecord.index.assertEquals(oldRecord.index);
    circuitLog('index assert success');
    oldRecord.accountName.assertEquals(account.name);
    circuitLog('account accountName assert success');
    account.checkManager(managerPrivateKey).assertTrue();

    this.reducer.dispatch(
      Action.updateRecord(newRecord, oldRecord.hash(), account.hash())
    );
  }

  @method
  delRecord(
    record: Record,
    account: MansAccount,
    managerPrivateKey: PrivateKey
  ) {
    record.isAssignedIndex().assertTrue();
    record.accountName.assertEquals(account.name);
    account.checkManager(managerPrivateKey).assertTrue();

    this.reducer.dispatch(
      Action.delRecord(record, record.hash(), account.hash())
    );
  }

  @method
  rollup(proof: MansRollupProof) {
    proof.verify();

    let state = this.state.get();
    this.state.assertEquals(state);

    this.account.sequenceState.assertEquals(
      proof.publicInput.target.currentActionsHash
    );

    proof.publicInput.source.assertEquals(state);
    this.state.set(proof.publicInput.target);
  }
}
