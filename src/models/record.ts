import { createEmptyValue } from 'snarky-smt';
import {
  arrayProp,
  Bool,
  CircuitValue,
  Encoding,
  Field,
  isReady,
  Poseidon,
  prop,
  UInt32,
} from 'snarkyjs';

await isReady;

export { Record, type RecordJSON };

const MAX_VALUE_SIZE = 8;
const DUMMY_INDEX = Field(0);
const EMPTY_FIELD = Field(0);

interface RecordJSON {
  index?: bigint;
  accountName: string;
  key: string;
  kind: string;
  label?: string;
  ttl?: number;
  value: string;
}

class Record extends CircuitValue {
  @prop index: Field;
  @prop accountName: Field;
  @prop key: Field;
  @prop kind: Field;
  @prop label: Field;
  @prop ttl: UInt32;
  @arrayProp(Field, MAX_VALUE_SIZE) value: Field[];

  constructor(
    index: Field,
    accountName: Field,
    key: Field,
    kind: Field,
    label: Field,
    ttl: UInt32,
    value: Field[]
  ) {
    super();
    this.index = index;
    this.accountName = accountName;
    this.key = key;
    this.kind = kind;
    this.label = label;
    this.ttl = ttl;
    this.value = value;
  }

  static create(r: RecordJSON): Record {
    let valueFs = Encoding.Bijective.Fp.fromString(r.value);
    if (valueFs.length > MAX_VALUE_SIZE) {
      throw new Error(
        `The value: ${r.value} cannot fit into ${MAX_VALUE_SIZE} fields`
      );
    }
    valueFs = valueFs.concat(
      Array(MAX_VALUE_SIZE - valueFs.length).fill(EMPTY_FIELD)
    );
    console.log('final valueFs length: ', valueFs.length);
    return new Record(
      r.index ? Field(r.index) : DUMMY_INDEX,
      convertStringToField(r.accountName),
      convertStringToField(r.key),
      convertStringToField(r.kind),
      r.label ? convertStringToField(r.label) : EMPTY_FIELD,
      r.ttl ? UInt32.from(r.ttl) : UInt32.from(200),
      valueFs
    );
  }

  toRecordJSON(): RecordJSON {
    return {
      index: this.index.toBigInt(),
      accountName: convertFieldToString(this.accountName),
      key: convertFieldToString(this.key),
      kind: convertFieldToString(this.kind),
      label: convertFieldToString(this.label),
      ttl: Number(this.ttl.toString()),
      value: Encoding.Bijective.Fp.toString(this.value),
    };
  }

  hash(): Field {
    return Poseidon.hash(this.toFields());
  }

  assignId(index: Field): Record {
    let newRecord = this.clone();
    newRecord.index = index;

    return newRecord;
  }

  isAssignedIndex(): Bool {
    return this.index.equals(DUMMY_INDEX).not();
  }

  clone(): Record {
    return new Record(
      this.index,
      this.accountName,
      this.key,
      this.kind,
      this.label,
      this.ttl,
      this.value.slice()
    );
  }

  static empty(): Record {
    return createEmptyValue(Record);
  }
}

function convertStringToField(s: string): Field {
  let fs = Encoding.Bijective.Fp.fromString(s);
  if (fs.length > 1) {
    throw new Error(`The string cannot fit into a field: ${s}`);
  }
  return fs[0];
}

function convertFieldToString(f: Field): string {
  return Encoding.Bijective.Fp.toString([f]);
}
