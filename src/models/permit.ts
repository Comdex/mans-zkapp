import {
  Bool,
  CircuitValue,
  Field,
  isReady,
  prop,
  PublicKey,
  Signature,
} from 'snarkyjs';

await isReady;

export const PERMIT_UPDATE_REGISTER_FEE = Field(1);
export const PERMIT_UPDATE_OWNER = Field(2);
export const PERMIT_UPDATE_MANSACCOUNT = Field(3);
export const PERMIT_UPDATE_MANSRECORD = Field(4);

export class PermitData extends CircuitValue {
  @prop permitType: Field;
  @prop data: Field;

  constructor(permitType: Field, data: Field) {
    super();
    this.permitType = permitType;
    this.data = data;
  }
}

export class Permit extends CircuitValue {
  @prop permitData: PermitData;
  @prop sign: Signature;

  constructor(permitData: PermitData, sign: Signature) {
    super();
    this.permitData = permitData;
    this.sign = sign;
  }

  verify(publicKey: PublicKey): Bool {
    return this.sign.verify(publicKey, this.permitData.toFields());
  }
}
