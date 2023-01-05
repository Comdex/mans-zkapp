# Mans: Mina Anonymous Name Service based on Actions/ZkProgram of SnarkyJs.

Mans is an exploratory anonymous name service developed based on Actions+ZkProgram. You can register a name whose latter is .mina and add a resolution record containing the wallet address and other information you want to disclose to this name. The owner address and manager address will be hidden and protected. Features that have been implemented: Support the registration and update of name accounts and the addition, modification and deletion of name-related resolution records.

This project uses the same technical solution as [nft-zkapp](https://github.com/Comdex/nft-zkapp), but the difference is that this project needs to simultaneously process the update of two merkle trees (one of which is a sparse merkle tree with a depth of 254) in the circuit. Due to the limitation of the circuit size and Static circuits are not friendly to multi-branch logic, and there are still many problems to be solved, but this is a solution worth trying.

### The main circuit logic

SmartContract: [src/mans_zkapp.ts](./src/mans_zkapp.ts)

RollupProver: [src/rollup_prover.ts](./src/rollup_prover.ts)

## How to build

```sh
npm run build
```

## How to run demo test

```sh
npm run mans
```

## License

[Apache-2.0](LICENSE)
