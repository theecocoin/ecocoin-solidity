pragma solidity ^0.5.0;

import "../ERC20Mutable.sol";

contract ERC20MutableMock is ERC20Mutable {

    constructor(address owner, uint256 initialSupply) public {
        _mint(owner, initialSupply);
    }

    function mint(address account, uint256 amount) public {
        _mint(account, amount);
    }

    function burn(address account, uint256 amount) public {
        _burn(account, amount);
    }

    function burnFrom(address account, uint256 amount) public {
        _burnFrom(account, amount);
    }

    function approveInternal(address owner, address spender, uint256 value) public {
        _approve(owner, spender, value);
    }

    function setTotalSupply(uint256 value) external {
        _setTotalSupply(value);
    }

    function setBalance(address account, uint256 value) external {
        _setBalance(account, value);
    }

}
