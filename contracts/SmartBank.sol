pragma solidity 0.4.25;

// This contract is deployed in Rinkeby Network at this address:
// 0x7a2F741383dD1067720863Ca3F30d62A24aA5313

// WARRANTIES OR CONDITIONS
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
// WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.

// Note: This smartcontract CONTAINS VULNERABILITIES and is developer for
// the purpose of exercise only. Do not use it in live networks.

contract SmartBank {
    /* Array of all user balances */
    mapping (address => uint256) private _balances;

    /* Array of last withdrawal blocks per user */
    mapping (address => uint256) private _withdrawBlocks;

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

        // Detect a megauser: User with >= 1000 Eth
        if (_balances[msg.sender] < 1000000000000000000000)
            require(value <= 100000000000000, "Only megausers can withdraw all");

        // Make sure users don't withdraw too frequently
        // Only one time per 6 hours ia allowed
        uint256 lastWithdraw = _withdrawBlocks[msg.sender];
        require(block.number - lastWithdraw > 6*266, "Withdrawing too frequently, please wait");

        require(msg.sender.send(value));
        _withdrawBlocks[msg.sender] = block.number;
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
