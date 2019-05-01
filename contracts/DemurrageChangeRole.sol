pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/access/Roles.sol";

contract DemurrageChangeRole {

    using Roles for Roles.Role;

    event DemurrageChangerAdded(address indexed account);
    event DemurrageChangerRemoved(address indexed account);

    Roles.Role private _demurrageChangers;

    constructor () internal {
        _addDemurrageChanger(msg.sender);
    }

    modifier onlyDemurrageChanger() {
        require(isDemurrageChanger(msg.sender), "DemurrageChangerRole: caller does not have the DemurrageChange role");
        _;
    }

    function isDemurrageChanger(address account) public view returns (bool) {
        return _demurrageChangers.has(account);
    }

    function addDemurrageChanger(address account) public onlyDemurrageChanger {
        _addDemurrageChanger(account);
    }

    function renounceDemurrageChanger() public {
        _removeDemurrageChanger(msg.sender);
    }

    function _addDemurrageChanger(address account) internal {
        _demurrageChangers.add(account);
        emit DemurrageChangerAdded(account);
    }

    function _removeDemurrageChanger(address account) internal {
        _demurrageChangers.remove(account);
        emit DemurrageChangerRemoved(account);
    }

}
