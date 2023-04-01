pragma solidity ^0.8.12;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract FakeUSDC is ERC20 {
    constructor(string memory name_, string memory symbol_, uint256 initialSupply_) ERC20(name_, symbol_) {
        _mint(msg.sender, initialSupply_);
    } 

    function decimals() public view virtual override returns (uint8) {
        return 6;
    }
}
