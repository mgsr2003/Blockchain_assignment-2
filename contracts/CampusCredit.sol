// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract CampusCredit is ERC20 {
    constructor(uint256 initialSupply) ERC20("CampusCredit", "CAMP") {
        _mint(msg.sender, initialSupply);
    }
}
