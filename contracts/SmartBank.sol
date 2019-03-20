pragma solidity 0.4.25;

// This contract is deployed in Rinkeby Network at this address:
// 0xf98864a5Cc043ABfF59BeE7fFE792bBaf960051f

// WARRANTIES OR CONDITIONS
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

// Note: This smartcontract CONTAINS VULNERABILITIES and is developer for
// the purpose of exercise only. Do not use it in live networks.

contract SmartBank {
    /* Array of all user balances */
    mapping (address => uint256) private _balances;

    /**
    *  Get user balance
    *
    * @param addr - address to query
    * @return Balance of address
    */
    function balanceOf(address addr)
        public
        view
        returns (uint256)
    {
        return _balances[addr];
    }

    /**
    *  Withdraw an amount
    *
    * @param value - wei amount to withdraw
    * @return True in case of success, otherwise false
    */
    function withdraw(uint256 value)
        external
        returns (bool)
    {
        require(_balances[msg.sender] >= value, "Insufficient balance for withdrawal");

        require(msg.sender.send(value));
        _balances[msg.sender] -= value;
        return true;
    }

    /**
    *  Transfer stored Ether to another address within the bank
    *
    * @param to - address to transfer ether to
    * @param value - number of wei to transfer
    * @return True in case of success, otherwise false
    */
    function transfer(address to, uint256 value)
        public
        returns (bool)
    {
        // Subtract amount from the sender
        _balances[msg.sender] -= value;

        // Add the same amount to the recipient
        _balances[to] += value;

        return true;
    }

    /**
    *  Default method
    *
    *  Make a deposit to our bank
    */
    function()
        external
        payable
    {
        _balances[msg.sender] += msg.value;
    }
}