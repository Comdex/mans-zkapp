import {
  arrayProp,
  CircuitValue,
  Field,
  isReady,
  Poseidon,
  prop,
  UInt32,
} from 'snarkyjs';

await isReady;

export const MAX_VALUE_SIZE = 6;
const EMPTY_VALUE = Field.zero;

export class RecordKey extends CircuitValue {
  @prop account: Field;
  @prop key: Field;
  @prop kind: Field;
  @prop label: Field;

  constructor(account: Field, key: Field, kind: Field, label: Field) {
    super();
    this.account = account;
    this.key = key;
    this.kind = kind;
    this.label = label;
  }

  hash(): Field {
    return Poseidon.hash(this.toFields());
  }
}

export class Record extends CircuitValue {
  @prop account: Field;
  @prop key: Field;
  @prop kind: Field;
  @prop label: Field;
  @prop ttl: UInt32;
  @arrayProp(Field, MAX_VALUE_SIZE) value: Field[];

  constructor(
    account: Field,
    key: Field,
    kind: Field,
    label: Field,
    ttl: UInt32,
    value: Field[]
  ) {
    super();
    this.account = account;
    this.key = key;
    this.kind = kind;
    this.label = label;
    this.ttl = ttl;
    this.value = value;
  }

  hash(): Field {
    return Poseidon.hash(this.toFields());
  }

  static empty(): Record {
    return new Record(
      Field.zero,
      Field.zero,
      Field.zero,
      Field.zero,
      UInt32.zero,
      new Array(MAX_VALUE_SIZE).fill(Field.zero)
    );
  }

  cloneWithPad(): Record {
    if (this.value.length > MAX_VALUE_SIZE) {
      throw new Error('The length of value is greater than ' + MAX_VALUE_SIZE);
    }

    let newValue: Field[] = [];
    this.value.forEach((v) => {
      newValue.push(v);
    });

    if (newValue.length < MAX_VALUE_SIZE) {
      for (let i = newValue.length; i < MAX_VALUE_SIZE; i++) {
        newValue.push(EMPTY_VALUE);
      }
    }

    return new Record(
      this.account,
      this.key,
      this.kind,
      this.label,
      this.ttl,
      newValue
    );
  }
}
