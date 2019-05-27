pragma solidity ^0.5.0;

import 'openzeppelin-solidity/contracts/ownership/Ownable.sol';
import 'openzeppelin-solidity/contracts/math/SafeMath.sol';
import "openzeppelin-solidity/contracts/access/roles/MinterRole.sol";
import "./DemurrageChangeRole.sol";
import "./ERC20Mutable.sol";

/**
 * @title ERC20 token contract with demurrage
 *
 * @dev With the DemurrageCoin contract, you can create tokens that vanish over time.
 * See https://en.wikipedia.org/wiki/Demurrage_%28currency%29 for background on this concept.
 *
 * The contract must be created with a fixed period. Demurrage is always based on this duration and
 * cannot be changed later. The rate of demurrage is applied to each token holder address for each period.
 * Changes to the demurrage rate can be scheduled for future periods.
 * Demurrage is calculated in a lazy way. It is applied to an account, when a transaction to or from the
 * account is done.
 */
contract ERC20Demurrageable is ERC20Mutable, Ownable, MinterRole, DemurrageChangeRole {

    /// Struct to hold a change to the demurrage rate for a given time period
    struct DemurrageChange {
        uint256 period; /// 0 is the first period, increases every 'periodDuration' seconds
        uint256 rate;   /// the rate of demurrage with fixed decimals (-> _rateDecimals)
    }

    /// Struct to hold the demurrage state of an account
    struct DemurrageState {
        uint256 onPeriod; /// Period until which demurrage is subtracted from the account
        uint256 onChange; /// Index of the latest DemurrageChange, this ...
    }

    uint8 private _rateDecimals; /// Number of decimals for the demurrage rate (see DemurrageChange struct)
    uint256 private _period0Beginning; /// Beginning of the first demurrage period, in seconds since the era
    uint32 private _periodDuration; /// Duration of a period on which demurrage is applied, in seconds

    DemurrageState private _totalSupplyDemurrageState;
    mapping(address => DemurrageState) private _balancesDemurrageState;

    mapping(uint256 => DemurrageChange) private _scheduledChanges;
    uint256 private _scheduledChangesCount;

    event ScheduleDemurrageChange(uint256 timestamp, uint256 period, uint256 rate);

    /**
     * @dev Constructor
     * @param demurrageRate Initial demurrage rate for first period.
     * @param rateDecimals Number of decimals for the demurrage rate.
     * @param period0Beginning Beginning of the first demurrage period, in seconds since the era.
     * @param periodDuration Duration of a period for demurrage, in seconds.
     */
    constructor(
        uint256 demurrageRate,
        uint8 rateDecimals,
        uint256 period0Beginning,
        uint32 periodDuration
    )
    public
    {
        require(period0Beginning <= now);

        _rateDecimals = rateDecimals;
        _period0Beginning = period0Beginning;
        _periodDuration = periodDuration;

        _scheduledChanges[0] = DemurrageChange(0, demurrageRate);
        _scheduledChangesCount = 1;

        emit ScheduleDemurrageChange(period0Beginning, 0, demurrageRate);

        _totalSupplyDemurrageState = DemurrageState(0, 0);
    }

    /**
     * @dev Schedule a change to the demurrage rate. The change must be scheduled for a future period.
     * Scheduled changes cannot be reverted. They guarantee a given rate for the users.
     * @param changePeriod The period in which the change will be applied.
     * @param changeRate The new demurrage rate to be applied from the given period onwards.
     */
    function scheduleDemurrageChange(uint256 changePeriod, uint256 changeRate) external onlyDemurrageChanger {
        // New period must be a future period
        require(changePeriod > getPeriod(now));
        // New period must be after the last scheduled period
        require(changePeriod > _scheduledChanges[_scheduledChangesCount - 1].period);

        _scheduledChanges[_scheduledChangesCount] = DemurrageChange(changePeriod, changeRate);
        _scheduledChangesCount++;

        emit ScheduleDemurrageChange(_period0Beginning + changePeriod * _periodDuration, changePeriod, changeRate);
    }

    /**
     * @dev Calculates the demurraged balance of an account and persists it.
     * This function is called automatically on demand, but it can also be called manually for maintenance.
     * @param account The account address for which to update and persist the demurrage.
     */
    function persistBalanceDemurrage(address account) public {
        uint256 demurragedBalance;
        (demurragedBalance, _balancesDemurrageState[account]) = _balanceOfDemurraged(
            super.balanceOf(account),
            _balancesDemurrageState[account]
        );
        _setBalance(account, demurragedBalance);
    }

    /**
     * @dev Calculates the demurraged total supply and persists it.
     * This function is called automatically on demand, but it can also be called manually for maintenance.
     */
    function persistTotalSupplyDemurrage() public {
        uint256 demurragedTotalSupply;
        (demurragedTotalSupply, _totalSupplyDemurrageState) = _balanceOfDemurraged(
            super.totalSupply(),
            _totalSupplyDemurrageState
        );
        _setTotalSupply(demurragedTotalSupply);
    }

    /**
     * @dev Get the demurrage period for a given timestamp.
     * @param timestamp Time to get the demurrage period for, in seconds since the era.
     * @return Demurrage period that includes the timestamp.
     */
    function getPeriod(uint256 timestamp) public view returns (uint256) {
        return (timestamp - _period0Beginning) / _periodDuration;
    }

    function getStartTimestamp(uint256 period) public view returns (uint256) {
        return period * _periodDuration + _period0Beginning;
    }

    /**
     * @dev Total number of tokens in existence.
     * @return Total number of tokens.
     */
    function totalSupply() public view returns (uint256 value) {
        (value,) = _balanceOfDemurraged(super.totalSupply(), _totalSupplyDemurrageState);
    }

    /**
     * @dev Gets the balance of the specified address.
     * @param owner The address to query the balance of.
     * @return A uint256 representing the amount owned by the passed address.
     */
    function balanceOf(address owner) public view returns (uint256 value) {
        (value,) = _balanceOfDemurraged(super.balanceOf(owner), _balancesDemurrageState[owner]);
    }

    /**
     * @dev Transfer the given number of tokens from token owner's account to the 'to' account.
     * Before doing the transfer, accounts of sender and receiver are updated with demurrage.
     * Owner's account must have sufficient balance to transfer. 0 value transfers are allowed.
     * @param to Address of token receiver.
     * @param value Amount of tokens to transfer.
     * @return 'true' on success.
     */
    function transfer(address to, uint256 value) public returns (bool) {
        persistBalanceDemurrage(msg.sender);
        persistBalanceDemurrage(to);
        return super.transfer(to, value);
    }

    /**
     * @dev Transfer 'value' tokens from the 'from' account to the 'to' account.
     * Before doing the transfer, accounts of sender and receiver are updated with demurrage.
     * From account must have sufficient balance to transfer.
     * Spender must have sufficient allowance to transfer.
     * 0 value transfers are allowed.
     * @param from Address to transfer tokens from.
     * @param to Address to transfer tokens to.
     * @param value Number of tokens to transfer.
     * @return 'true' on success.
     */
    function transferFrom(address from, address to, uint256 value) public returns (bool) {
        persistBalanceDemurrage(from);
        persistBalanceDemurrage(to);
        return super.transferFrom(from, to, value);
    }

    /**
     * @dev Mint new coins.
     * Before the minting, account of receiver and total supply are updated with demurrage.
     * @param to Address to put the minted coins into.
     * @param value Amount of tokens to mint.
     * @return 'true' on success.
     */
    function mint(address to, uint256 value) public onlyMinter returns (bool) {
        persistBalanceDemurrage(to);
        persistTotalSupplyDemurrage();
        _mint(to, value);
        return true;
    }

    /**
     * @dev Burn coins in message sender's account.
     * Before the burning, account of sender's account and totalSupply are updated with demurrage.
     * @param value Amount of tokens to burn.
     * @return 'true' on success.
     */
    function burn(uint256 value) public {
        persistBalanceDemurrage(msg.sender);
        persistTotalSupplyDemurrage();
        _burn(msg.sender, value);
    }

    /**
     * @dev Burns a specific amount of tokens from the target address and decrements allowance.
     * @param from The account whose tokens will be burned.
     * @param value The amount of token to be burned.
     */
    function burnFrom(address from, uint256 value) public {
        persistBalanceDemurrage(from);
        persistTotalSupplyDemurrage();
        _burnFrom(from, value);
    }

    /**
     * @dev Contract does not accept ETH
     */
    function() external payable {
        revert();
    }

    /**
     * @dev If other ERC20 tokens are accidentally sent to this contract, the owner can
     * transfer them out.
     * @param tokenAddress Address of a token contract that corresponds to the sent tokens.
     * @param value Number of tokens to transfer.
     * @return 'true' on success.
     */
    function transferAnyERC20Token(address tokenAddress, uint256 value) public onlyOwner returns (bool) {
        return IERC20(tokenAddress).transfer(owner(), value);
    }

    /**
     * @dev Calculate the demurraged balance of an account.
     * For a given balance, it applies the demurrage rate for each outstanding period until 'now'.
     * @param value Base value for which to calculate the demurraged value.
     * @param demurrageState State of demurrage of the value.
     * @return Demurraged value and new DemurrageState struct.
     */
    function _balanceOfDemurraged(uint256 value, DemurrageState storage demurrageState)
    internal
    view
    returns (uint256, DemurrageState memory)
    {
        uint256 demurragedValue = value;
        uint256 startPeriod = demurrageState.onPeriod;
        uint256 endPeriod;
        uint256 nowPeriod = getPeriod(now);
        uint256 i;

        // Iterate over outstanding changes to the demurrage rate
        for (i = demurrageState.onChange; i < _scheduledChangesCount; i++) {

            DemurrageChange storage currentChange = _scheduledChanges[i];

            // Check if there will be more demurrage changes to apply
            bool moreChanges = i < _scheduledChangesCount - 1 && _scheduledChanges[i + 1].period < nowPeriod;
            if (moreChanges) {
                endPeriod = _scheduledChanges[i + 1].period;
            } else {
                endPeriod = nowPeriod;
            }

            // Demurrage the balance over period interval [startPeriod, endPeriod[
            demurragedValue = demurragedValue * rpow(currentChange.rate, endPeriod - startPeriod, 10 ** uint256(_rateDecimals)) / (10 ** uint256(_rateDecimals));

            if (!moreChanges) {
                break;
            }
            startPeriod = endPeriod;
        }

        return (demurragedValue, DemurrageState(endPeriod, i));
    }

    /**
     * @dev Calculates 'x' by the power of 'n' with a 'base'.
     * The base allows for calculating the power with uint using decimals.
     * Taken from https://github.com/makerdao/dsr/blob/master/src/dsr.sol
     */
    function rpow(uint256 x, uint256 n, uint256 base) public pure returns (uint256 z) {
        assembly {
            switch x case 0 {switch n case 0 {z := base} default {z := 0}}
            default {
                switch mod(n, 2) case 0 {z := base} default {z := x}
                let half := div(base, 2)  // for rounding.
                for {n := div(n, 2)} n {n := div(n, 2)} {
                let xx := mul(x, x)
                if iszero(eq(div(xx, x), x)) {revert(0, 0)}
                let xxRound := add(xx, half)
                if lt(xxRound, xx) {revert(0, 0)}
                x := div(xxRound, base)
                if mod(n, 2) {
                    let zx := mul(z, x)
                    if and(iszero(iszero(x)), iszero(eq(div(zx, x), z))) {revert(0, 0)}
                    let zxRound := add(zx, half)
                    if lt(zxRound, zx) {revert(0, 0)}
                    z := div(zxRound, base)
                }
            }
            }
        }
    }

}