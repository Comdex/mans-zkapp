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

export class Permit extends CircuitValue {
  @prop type: Field;
  @prop dataHash: Field;
  @prop sign: Signature;

  constructor(type: Field, dataHash: Field, sign: Signature) {
    super();
    this.type = type;
    this.dataHash = dataHash;
    this.sign = sign;
  }

  verify(publicKey: PublicKey): Bool {
    return this.sign.verify(publicKey, [this.type, this.dataHash]);
  }

  forRegisterFee(): Bool {
    return this.type.equals(PERMIT_UPDATE_REGISTER_FEE);
  }

  forUpdateOwner(): Bool {
    return this.type.equals(PERMIT_UPDATE_REGISTER_FEE);
  }
}
