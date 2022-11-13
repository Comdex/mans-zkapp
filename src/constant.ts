import { MemoryStore, MerkleTree, SparseMerkleTree } from 'snarky-smt';
import { Field, PrivateKey, PublicKey, UInt64 } from 'snarkyjs';
import { Record } from './models/record';

export const ACTION_BATCH_SIZE = 1;
export const RECORDS_TREE_HEIGHT = 30;
export const INITIAL_ACCOUNTS_ROOT = SparseMerkleTree.initialPoseidonHashRoot;
export const INITIAL_RECORDS_ROOT = (
  await MerkleTree.build(new MemoryStore<Record>(), RECORDS_TREE_HEIGHT)
).getRoot();
export const REGISTER_FEE = UInt64.from(10_000);
export const INITIAL_RECORDS_INDEX = Field(0);
export const OWNER_PUBLICKEY = PublicKey.fromBase58(
  'B62qqVtbTK3mBcb1Ytbr61zMfAR6hwc978Wwfcn4uZkU9YEhbs5jTij'
);
export const ONWER_PRIVATEKEY = PrivateKey.fromBase58(
  'EKE6U8wNtZRPLtAK15sPtikkmNnJkuFxvGc7bQGAm67Ycxrnon1Z'
);
