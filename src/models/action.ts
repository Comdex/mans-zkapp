import { createEmptyValue } from 'snarky-smt';
import { arrayProp, Bool, CircuitValue, Field, isReady, prop } from 'snarkyjs';
import { MansAccount } from './account';
import { Record } from './record';

await isReady;

const ACTION_TYPE_DUMMY_DATA = Field(0);
const ACTION_TYPE_REGISTER_ACCOUNT = Field(1);
const ACTION_TYPE_UPDATE_ACCOUNT = Field(2);
const ACTION_TYPE_ADD_RECORD = Field(3);
const ACTION_TYPE_UPDATE_RECORD = Field(4);
const ACTION_TYPE_DEL_RECORD = Field(5);

const RECORD_VALUE_SIZE = Record.sizeInFields();
const ACCOUNT_VALUE_SIZE = MansAccount.sizeInFields();

const EMPTY_FIELD = Field(0);

export class Action extends CircuitValue {
  @prop type: Field;
  @arrayProp(Field, RECORD_VALUE_SIZE) value: Field[];
  @prop originalHash: Field;
  @prop operatingAccountHash: Field;

  constructor(
    type: Field,
    value: Field[],
    originalHash: Field,
    operatingAccountHash: Field
  ) {
    super();
    this.type = type;
    this.value = value;
    this.originalHash = originalHash;
    this.operatingAccountHash = operatingAccountHash;
  }

  static empty(): Action {
    return createEmptyValue(Action);
  }

  getAccount(): MansAccount {
    let startPos = RECORD_VALUE_SIZE - ACCOUNT_VALUE_SIZE;
    return MansAccount.ofFields(
      this.value.slice(startPos, startPos + ACCOUNT_VALUE_SIZE)
    );
  }

  getRecord(): Record {
    return Record.ofFields(this.value);
  }

  isDummyData(): Bool {
    return this.type.equals(ACTION_TYPE_DUMMY_DATA);
  }

  isRegisterAccount(): Bool {
    return this.type.equals(ACTION_TYPE_REGISTER_ACCOUNT);
  }

  isUpdateAccount(): Bool {
    return this.type.equals(ACTION_TYPE_UPDATE_ACCOUNT);
  }

  isAddRecord(): Bool {
    return this.type.equals(ACTION_TYPE_ADD_RECORD);
  }

  isUpdateRecord(): Bool {
    return this.type.equals(ACTION_TYPE_UPDATE_RECORD);
  }

  isDelRecord(): Bool {
    return this.type.equals(ACTION_TYPE_DEL_RECORD);
  }

  static registerAccount(account: MansAccount): Action {
    let fs = account.toFields();
    fs = Array(RECORD_VALUE_SIZE - ACCOUNT_VALUE_SIZE)
      .fill(EMPTY_FIELD)
      .concat(fs);

    return new Action(
      ACTION_TYPE_REGISTER_ACCOUNT,
      fs,
      EMPTY_FIELD,
      EMPTY_FIELD
    );
  }

  static updateAccount(account: MansAccount, originalHash: Field): Action {
    let fs = account.toFields();
    fs = Array(RECORD_VALUE_SIZE - ACCOUNT_VALUE_SIZE)
      .fill(EMPTY_FIELD)
      .concat(fs);

    return new Action(
      ACTION_TYPE_UPDATE_ACCOUNT,
      fs,
      originalHash,
      EMPTY_FIELD
    );
  }

  static addRecord(record: Record, accountHash: Field): Action {
    let fs = record.toFields();

    return new Action(ACTION_TYPE_ADD_RECORD, fs, EMPTY_FIELD, accountHash);
  }

  static updateRecord(
    record: Record,
    originalHash: Field,
    accountHash: Field
  ): Action {
    let fs = record.toFields();

    return new Action(ACTION_TYPE_UPDATE_RECORD, fs, originalHash, accountHash);
  }

  static delRecord(
    record: Record,
    originalHash: Field,
    accountHash: Field
  ): Action {
    let fs = record.toFields();

    return new Action(ACTION_TYPE_DEL_RECORD, fs, originalHash, accountHash);
  }
}
