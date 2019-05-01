# <img src="logo.png" alt="The ECO coin project" width="500px">

This repository contains the Ethereum solidity implementation of the ECO coin.

The ECO coin is a digital currency to help people live a sustainable life. 
> Read more about the project at https://www.ecocoin.com.


## An ERC20 token with demurrage
 
The main contribution of this repository is the implementation of a token with demurrage. Demurrage incentivises users to spend their tokens and discourages them to hodl. Thus it is meant to stimulate trading and the economy in general. 

With a demurrage currency, savings and balances are reduced over time.
 
> Learn more about the concept of a demurrage currency at wikipedia: https://en.wikipedia.org/wiki/Demurrage_%28currency%29

The code is based on the ERC20 token implementation of the OpenZeppelin project and on work done by the MakerDAO project.

It provides the ERC20Demurrageable contract as a basis for tokens with demurrage.


## Demurrage implementation overview

The ERC20Demurrageable contract implements demurrage as follows:

* Time is divided into fixed length **periods**, e.g. 30 days. The first period starts when the contract is deployed (or at an earlier time).
* When a period has passed, all account balances and the total supply is reduced by the **demurrage rate**, e.g. 0.15%. Over multiple periods, the demurrage is taken repeatedly for each period. 
* **Changes to the demurrage rate** can be scheduled for future periods. However, when a change is scheduled, it can not be reverted. Instead a new change can be scheduled for a following period. This gives the users of the currency some security over the amount of future demurrage.

## Demurrage Calculation

 The demurraged balance after a number of periods can be calculated with this formula:
 ```
 demurraged balance = initial balance * (1 - demurrage rate) ^ periods
  ```

## Demurrage Example
 
 As a illustrative example, let us set up a demurage currency with parameters:
 * demurrage rate is 0.15%
 * period duration is 30 days
 * initial balance in 100 tokens
 
 To calculate the demurraged balance after one year (approx. 12 periods):
 ```
 100 tokens * (1 - 0.15%) ^ 12 = 98.215 tokens
 ```

## Implementation Details

### Demurrage Rate

The demurrage rate is represented as an unsigned integer number with a given number of decimals. To calculate the power function of it, the **rpow** function was adopted from the MakerDAO project.

* uint DemurrageChange.rate
* uint _rateDecimals 
* function rpow

### Demurrage Changes

Changes to the demurrage rate are saved in an array and can only be appended for future periods. If demurrage is calculated over a time with a changing demurrage rate, the changes are iterated over and the formula from above is applied for each change seperately.

* struct DemurrageChange
* mapping _scheduledChanges
* uint _scheduledChangesCount 

### Lazy Calculation

For demurrage to be calculated, the balances in all accounts have to be modified each period. If that would be done through an eager strategy, it would regularly consume significant amounts of gas.

Instead, it is implemented in a lazy way. For each account, a record is stored that keeps track of when the last demurrage was calculated for a given account. When *balanceOf* is called for an account, it calculates the outstanding demurrage and returns the resulting balance (but does not save any data, since it is a *view* function).

When a *transfer* is done from one account to the other, the outstanding demurrage is calculated first on both accounts, the results are saved to the accounts and then the transfer is done in the usual way. 

As a result, active accounts are regularly updated, while inactive accounts are not touched (until tokens are transferred in or out).

You can also call the function *persistBalanceDemurrage* to force an account to be updated.

### What happens to the demurraged tokens?

The tokens, that are reduced from balances by demurrage just disappear. They are not transferred to any other account. Thus, total supply of tokens is also reduced.

There is a small difference to burning tokens: when tokens get burned, a transfer event to address 0x0 is produced. No event is produced to represent demurrage, it just happens. 

To keep the total supply of tokens stable over time, you have to mint new tokens regularly.

## License

The ECO coin solidity implementation is released under the CC BY 4.0 license https://creativecommons.org/licenses/by/4.0/