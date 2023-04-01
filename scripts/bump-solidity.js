const fs = require("fs");
const solidityRegex = /pragma solidity \^\d+\.\d+\.\d+/

let content = fs.readFileSync("./contracts/verifier.sol", { encoding: 'utf-8' });
let bumped = content.replace(solidityRegex, 'pragma solidity ^0.8.12');

fs.writeFileSync("./contracts/verifier.sol", bumped);
