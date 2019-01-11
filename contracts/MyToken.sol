pragma solidity 0.4.25;
import './Owned.sol';
import './TokenParameters.sol';

contract MyToken is Owned, TokenParameters {
    /* Public variables of the token */
    string public standard = 'ERC-20';
    string public name = 'My Pretty Token';
    string public symbol = 'XXX';
    uint8 public decimals = 18;

    /* Arrays of all balances, vesting, approvals, and approval uses */
    mapping (address => uint256) private _balances;   // Total token balances
    mapping (address => mapping (address => uint256)) private _allowed;

    /* This generates a public event on the blockchain that will notify clients */
    event Transfer(address indexed from, address indexed to, uint256 tokens);
    event Approval(address indexed tokenOwner, address indexed spender, uint256 tokens);
    event Destruction(uint256 _amount); // triggered when the total supply is decreased
    event NewTANToken(address _token);

    /* Miscellaneous */
    uint256 public totalSupply = 0;
    address private _admin;

    /**
    *  Constructor
    *
    *  Initializes contract with initial supply tokens to the creator of the contract
    */
    constructor()
        public
    {
        owner = msg.sender;
        _admin = msg.sender;
        mintToken(TokenParameters.initialTokenOwnerAddress, TokenParameters.initialSupply);
        emit NewTANToken(address(this));
    }

    modifier onlyOwnerOrAdmin() {
        require((msg.sender == owner) || (msg.sender == _admin));
        _;
    }

    /**
    *  Function to set new admin for automated setting of exchange rate
    *
    */
    function setAdmin(address newAdmin)
        external
        onlyOwner
    {
        require(newAdmin != address(0));
        _admin = newAdmin;
    }

    /**
    *  Get token balance of an address
    *
    * @param addr - address to query
    * @return Token balance of address
    */
    function balanceOf(address addr)
        public
        view
        returns (uint256)
    {
        return _balances[addr];
    }

    /**
    *  Get token amount allocated for a transaction from _owner to _spender addresses
    *
    * @param tokenOwner - owner address, i.e. address to transfer from
    * @param tokenSpender - spender address, i.e. address to transfer to
    * @return Remaining amount allowed to be transferred
    */
    function allowance(address tokenOwner, address tokenSpender)
        public
        view
        returns (uint256)
    {
        return _allowed[tokenOwner][tokenSpender];
    }

    /**
    *  Send coins from sender's address to address specified in parameters
    *
    * @param to - address to send to
    * @param value - amount to send in Wei
    */
    function transfer(address to, uint256 value)
        public
        returns (bool)
    {
        require(_balances[msg.sender] >= value, "Insufficient balance for transfer");

        // Subtract from the sender
        // _value is never greater than balance of input validation above
        _balances[msg.sender] -= value;

        // Overflow is never possible due to input validation above
        _balances[to] += value;

        emit Transfer(msg.sender, to, value);
        return true;
    }

    /**
    *  Create token and credit it to target address
    *  Created tokens need to vest
    *
    */
    function mintToken(address tokenOwner, uint256 amount)
        internal
    {
        // Mint happens right here: Balance becomes non-zero from zero
        _balances[tokenOwner] += amount;
        totalSupply += amount;

        // Emit Transfer event
        emit Transfer(address(0), tokenOwner, amount);
    }

    /**
    *  Allow another contract to spend some tokens on your behalf
    *
    * @param spender - address to allocate tokens for
    * @param value - number of tokens to allocate
    * @return True in case of success, otherwise false
    */
    function approve(address spender, uint256 value)
        public
        returns (bool)
    {
        require(_balances[msg.sender] >= value, "Insufficient balance for approval");

        _allowed[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    /**
    *  A contract attempts to get the coins. Tokens should be previously allocated
    *
    * @param to - address to transfer tokens to
    * @param from - address to transfer tokens from
    * @param value - number of tokens to transfer
    * @return True in case of success, otherwise false
    */
    function transferFrom(address from, address to, uint256 value)
        public
        returns (bool)
    {
        // Check allowed
        require(value <= _allowed[from][msg.sender]);
        require(_balances[from] >= value);

        // Subtract from the sender
        // _value is never greater than balance because of input validation above
        _balances[from] -= value;
        // Add the same to the recipient
        // Overflow is not possible because of input validation above
        _balances[to] += value;

        // Deduct allocation
        // _value is never greater than allowed amount because of input validation above
        _allowed[from][msg.sender] -= value;

        emit Transfer(from, to, value);
        return true;
    }

    /**
    *  Default method
    *
    *  This unnamed function is called whenever someone tries to send ether to
    *  it. Just revert transaction because there is nothing that Token can do
    *  with incoming ether.
    *
    *  Missing payable modifier prevents accidental sending of ether
    */
    function() public {
    }

    /**
    *  Destruction (burning) of owner tokens. Only owner of this contract can
    *  use it to burn their tokens.
    *
    *  Total Supply is decreased by the amount of burned tokens
    *
    * @param amount - Wei amount of tokens to burn
    */
    function destroy(uint256 amount)
        external
        onlyOwnerOrAdmin
    {
        require(amount <= _balances[msg.sender]);

        // Destroyed amount is never greater than total supply,
        // so no underflow possible here
        totalSupply -= amount;
        _balances[msg.sender] -= amount;
        emit Destruction(amount);
    }

    /**
    *  Mass distribution of token
    *
    *  Transfers token from admin address to multiple addresses
    *
    * @param _recipients - array of recipient addresses
    * @param _tokenAmounts - array of amounts of tokens to send
    */
    function multiTransfer(address[] _recipients, uint[] _tokenAmounts)
        external
        onlyOwnerOrAdmin
    {
        uint256 totalAmount = 0;
        uint256 len = _recipients.length;
        uint256 i;

        // Calculate total amount
        for (i=0; i<len; i++)
        {
            totalAmount += _tokenAmounts[i];
        }
        require(_balances[msg.sender] >= totalAmount);

        // Decrease sender balance by total amount
        _balances[msg.sender] -= totalAmount;

        for (i=0; i<len; i++)
        {
            // Increase balance of each recipient
            _balances[_recipients[i]] += _tokenAmounts[i];

            // Emit Transfer event
            emit Transfer(msg.sender, _recipients[i], _tokenAmounts[i]);
        }
    }

}
