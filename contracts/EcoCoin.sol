pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20Detailed.sol";
import "./ERC20Demurrageable.sol";

/**
 * @title EcoCoin token contract
 */
contract EcoCoin is ERC20Demurrageable, ERC20Detailed {

    constructor()
    ERC20Demurrageable(
        9985 * (10 ** uint(25 - 4)), // 0.15% demurrage rate per period
        25, // 25 decimals precision for calculating demurrage
        now, // beginning of demurrage period 0
        30 days // duration of a demurrage period
    )
    ERC20Detailed(
        "EcoCoin - Do good. Get paid.", // name
        "ECO", // symbol
        18 // decimals
    )
    public
    {
    }

}
