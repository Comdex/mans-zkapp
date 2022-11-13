import {
  AccountUpdate,
  Mina,
  PrivateKey,
  Permissions,
  Encoding,
  Field,
  shutdown,
} from 'snarkyjs';
import { ACTION_BATCH_SIZE } from './constant';
import { indexerState, runRollupProveAndUpdateIndexer } from './indexer';
import { MansZkapp } from './mans_zkapp';
import { MansAccount } from './models/account';
import { Record } from './models/record';
import { RollupState } from './models/rollup_state';
import { MansRollupProver } from './rollup_prover';

const addRecord = true;
const updateRecord = true;
const delRecord = true;

const doProofs = true;
const registerAccountTxns = ACTION_BATCH_SIZE;
const updateAccountTxns = ACTION_BATCH_SIZE;
const addRecordTxns = ACTION_BATCH_SIZE;
const updateRecordTxns = ACTION_BATCH_SIZE;
const delRecordTxns = 1;

let Local = Mina.LocalBlockchain();
Mina.setActiveInstance(Local);

let feePayerKey = Local.testAccounts[0].privateKey;
let callerKey = PrivateKey.fromBase58(
  'EKE51yW4HbYD9Xf1mLAechtFLHM8vRWGqJuowJXDGBy8VbMvTeiZ'
); //Local.testAccounts[1].privateKey;
let callerPublicKey = callerKey.toPublicKey();

let MINA = 10n ** 9n;
const largeValue = 1000n * MINA;
Local.addAccount(callerPublicKey, largeValue.toString());

let caller2Key = PrivateKey.fromBase58(
  'EKE51yW4HbYD9Xf1mLAechtFLHM8vRWGqJuowJXDGBy8VbMvTeiZ'
);
let caller2PublicKey = caller2Key.toPublicKey();

let receiverKey = Local.testAccounts[2].privateKey;
let receiverPublicKey = receiverKey.toPublicKey();
let zkappKey = PrivateKey.random();
let zkappAddress = zkappKey.toPublicKey();

async function test() {
  let zkapp = new MansZkapp(zkappAddress);

  //analyze methods
  let result = MansZkapp.analyzeMethods();
  console.log('MansZkapp analyze result: ', result);

  console.log('start compiling MansRollupProver');
  console.time('MansRollupProver compile');
  await MansRollupProver.compile();
  console.timeEnd('MansRollupProver compile');

  if (doProofs) {
    console.log('start compiling MansZkapp');
    console.time('MansZkapp compile');
    await MansZkapp.compile();
    console.timeEnd('MansZkapp compile');
  }

  console.log('deploying');
  let tx = await Mina.transaction(feePayerKey, () => {
    AccountUpdate.fundNewAccount(feePayerKey);
    zkapp.deploy({ zkappKey });

    if (!doProofs) {
      zkapp.setPermissions({
        ...Permissions.default(),
        editState: Permissions.proofOrSignature(),
        editSequenceState: Permissions.proofOrSignature(),
      });
    }
  });
  tx.send();
  console.log('deploy done');

  let accounts: MansAccount[] = [];
  for (let i = 0; i < registerAccountTxns; i++) {
    let account = MansAccount.create(
      'test' + i,
      callerPublicKey,
      callerPublicKey
    );
    accounts.push(account);
  }
  let records: Record[] = [];
  for (let i = 0; i < registerAccountTxns; i++) {
    let account = accounts[i];
    let accountName = Encoding.Bijective.Fp.toString([account.name]);
    console.log('account name: ', accountName);
    let record = Record.create({
      accountName,
      key: 'mina',
      kind: 'address',
      value: 'B62qpYmDbDJAyADVkJzydoz7QeZy1ZTiWeH1LSuyMxXezvu5mAQi53U',
    });
    records.push(record);
  }

  // register account
  for (let i = 0; i < registerAccountTxns; i++) {
    let account = accounts[i];
    tx = await Mina.transaction(feePayerKey, () => {
      //let accountUpdate = AccountUpdate.createSigned(callerKey);
      zkapp.registerAccount(account, callerKey);

      if (!doProofs) zkapp.sign(zkappKey);
    });
    if (doProofs) await tx.prove();
    tx.send();
  }

  let sequenceState = zkapp.account.sequenceState.get();
  console.log(
    'after submit register account action, sequence state: ',
    sequenceState.toString()
  );

  // update account
  for (let i = 0; i < updateAccountTxns; i++) {
    tx = await Mina.transaction(feePayerKey, () => {
      let account = accounts[i];
      let newAccount = account.changeOwner(caller2PublicKey);
      zkapp.updateAccount(newAccount, account, callerKey);

      if (!doProofs) zkapp.sign(zkappKey);
    });
    if (doProofs) await tx.prove();
    tx.send();
  }

  sequenceState = zkapp.account.sequenceState.get();
  console.log(
    'after submit update account action, sequence state: ',
    sequenceState.toString()
  );

  // add record
  if (addRecord) {
    for (let i = 0; i < addRecordTxns; i++) {
      let account = accounts[i];
      let record = records[i];
      tx = await Mina.transaction(feePayerKey, () => {
        zkapp.addRecord(record, account, callerKey);

        if (!doProofs) zkapp.sign(zkappKey);
      });
      if (doProofs) await tx.prove();
      tx.send();
    }

    // make add record in indexer
    let currIndex = 0;
    for (let i = 0; i < addRecordTxns; i++) {
      let record = records[i];
      currIndex = currIndex + 1;
      record.index = Field(currIndex);
    }

    sequenceState = zkapp.account.sequenceState.get();
    console.log(
      'after submit add record action, sequence state: ',
      sequenceState.toString()
    );
  }

  // update record
  if (updateRecord) {
    for (let i = 0; i < updateRecordTxns; i++) {
      tx = await Mina.transaction(feePayerKey, () => {
        let account = accounts[i];
        let record = records[i];
        let newRecordJSON = record.toRecordJSON();
        // update the record
        newRecordJSON.value =
          'B62qpYmDbDJAyADVkJzydoz7QeZy1ZTiWeH1LSuyMxXezvu5mXXXX';
        let newRecord = Record.create(newRecordJSON);
        zkapp.updateRecord(newRecord, record, account, callerKey);

        if (!doProofs) zkapp.sign(zkappKey);
      });
      if (doProofs) await tx.prove();
      tx.send();
    }

    sequenceState = zkapp.account.sequenceState.get();
    console.log(
      'after submit update record action, sequence state: ',
      sequenceState.toString()
    );
  }

  // del record
  if (delRecord) {
    for (let i = 0; i < delRecordTxns; i++) {
      let account = accounts[i];
      let record = records[i];
      tx = await Mina.transaction(feePayerKey, () => {
        zkapp.delRecord(record, account, callerKey);

        if (!doProofs) zkapp.sign(zkappKey);
      });
      if (doProofs) await tx.prove();
      tx.send();
    }

    sequenceState = zkapp.account.sequenceState.get();
    console.log(
      'after submit del record action, sequence state: ',
      sequenceState.toString()
    );
  }

  // rollup
  let mergedProof = await runRollupProveAndUpdateIndexer(zkapp);

  console.log('zkapp rollup tx 1 start');
  console.time('rollup txn');
  tx = await Mina.transaction(feePayerKey, () => {
    zkapp.rollup(mergedProof!);
    if (!doProofs) zkapp.sign(zkappKey);
  });
  if (doProofs) await tx.prove();
  tx.send();
  console.timeEnd('rollup txn');
  console.log('zkapp rollup tx 1 end');

  let afterRollupState = zkapp.state.get();
  console.log('after rollup txn state: ', afterRollupState.toPretty());

  let afterRollupIndexerState = new RollupState(
    indexerState.currentAccountsRoot,
    indexerState.lastProcessedRecordIndex,
    indexerState.currentRecordsRoot,
    indexerState.lastProcessedActionsHash
  );
  console.log('compare zkapp state and indexer state');
  console.log('afterRollupIndexerState: ', afterRollupIndexerState.toPretty());
  afterRollupState.assertEquals(afterRollupIndexerState);
  console.log('compare success');

  shutdown();
}

await test();
