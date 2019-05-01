pragma solidity ^0.5.0;

import "../ERC20Demurrageable.sol";

contract ERC20DemurrageableMock is ERC20Demurrageable {

    constructor(
        uint256 demurrageRate,
        uint8 rateDecimals,
        uint256 period0Beginning,
        uint32 periodDuration
    )
    public
    ERC20Demurrageable(demurrageRate, rateDecimals, period0Beginning, periodDuration)
    {

    }
}
