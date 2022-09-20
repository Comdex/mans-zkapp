import { CircuitValue, Field, isReady, prop } from 'snarkyjs';
import { MansAccount } from './account';
import { Record } from './record';

await isReady;

export const ACTION_TYPE_REGISTER = Field(0);
export const ACTION_TYPE_UPDATE_ACCOUNT = Field(1);
export const ACTION_TYPE_UPDATE_RECORD = Field(2);

export class Action extends CircuitValue {
  @prop type: Field;
  @prop operatingAccount: MansAccount;
  @prop accountUpdate: MansAccount;
  @prop recordUpdate: Record;

  constructor(
    type: Field,
    operatingAccount: MansAccount,
    accountUpdate: MansAccount,
    recordUpdate: Record
  ) {
    super();
    this.type = type;
    this.operatingAccount = operatingAccount;
    this.accountUpdate = accountUpdate;
    this.recordUpdate = recordUpdate;
  }

  static registerAccount(account: MansAccount): Action {
    return new Action(
      ACTION_TYPE_REGISTER,
      MansAccount.empty(),
      account,
      Record.empty()
    );
  }

  static updateAccount(
    accountUpdate: MansAccount,
    operatingAccount: MansAccount
  ): Action {
    return new Action(
      ACTION_TYPE_UPDATE_ACCOUNT,
      operatingAccount,
      accountUpdate,
      Record.empty()
    );
  }

  static updateRecord(
    recordUpdate: Record,
    operatingAccount: MansAccount
  ): Action {
    return new Action(
      ACTION_TYPE_UPDATE_RECORD,
      operatingAccount,
      MansAccount.empty(),
      recordUpdate
    );
  }
}
