const SafeMath = artifacts.require("openzeppelin-solidity/contracts/math/SafeMath");
const EcoCoin = artifacts.require("EcoCoin");

module.exports = function(deployer) {
  deployer.deploy(SafeMath);
  deployer.link(SafeMath, EcoCoin);
  deployer.deploy(EcoCoin);
};
