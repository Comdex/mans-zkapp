import { Circuit } from 'snarkyjs';

export { circuitLog };

function circuitLog(...args: any) {
  Circuit.asProver(() => {
    let prettyArgs = [];
    for (let arg of args) {
      if (arg?.toPretty !== undefined) prettyArgs.push(arg.toPretty());
      else {
        try {
          prettyArgs.push(JSON.parse(JSON.stringify(arg)));
        } catch {
          prettyArgs.push(arg);
        }
      }
    }
    console.log(...prettyArgs);
  });
}
