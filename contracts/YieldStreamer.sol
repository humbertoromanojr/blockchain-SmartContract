// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract YieldStreamer is ReentrancyGuard {
    using SafeERC20 for IERC20;

    error ZeroAddress();
    error ZeroAmount();
    error InsufficientBalance();

    IERC20 public immutable token;
    uint256 public constant YIELD_RATE_PER_SECOND = 10; 

    // TODO: Add tracking mappings/structs for users here
    // Estrutura para tracking de usuários
    struct UserInfo {
        uint256 balance;              // Saldo principal depositado
        uint256 lastUpdateTimestamp;  // Último timestamp de atualização
        uint256 accumulatedYield;     // Yield acumulado não reclamado
    }

    mapping(address => UserInfo) public users;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event YieldClaimed(address indexed user, uint256 amount);

    constructor(address _token) {
        if (_token == address(0)) revert ZeroAddress();
        token = IERC20(_token);
    }

        /**
     * @dev Atualiza o yield acumulado para um usuário
     */
    function _updateYield(address user) internal {
        UserInfo storage userInfo = users[user];
        
        if (userInfo.balance > 0 && userInfo.lastUpdateTimestamp > 0) {
            uint256 timeElapsed = block.timestamp - userInfo.lastUpdateTimestamp;
            uint256 yieldEarned = timeElapsed * YIELD_RATE_PER_SECOND * userInfo.balance;
            userInfo.accumulatedYield += yieldEarned;
        }
        
        userInfo.lastUpdateTimestamp = block.timestamp;
}

    function deposit(uint256 amount) external {
        // TODO: Implement logic (Update yield tracking before changing principal balance)
        if (amount == 0) revert ZeroAmount();
        
        // Atualiza yield antes de mudar o saldo
        _updateYield(msg.sender);
        
        // Transfere tokens do usuário para o contrato
        SafeERC20.safeTransferFrom(token, msg.sender, address(this), amount);
        
        // Atualiza o saldo do usuário
        users[msg.sender].balance += amount;
        
        emit Deposited(msg.sender, amount);
    }

    function pendingYield(address user) public view returns (uint256) {
        // TODO: Calculate linear time delta * YIELD_RATE_PER_SECOND
        return 0;
        UserInfo storage userInfo = users[user];
        
        if (userInfo.balance == 0 || userInfo.lastUpdateTimestamp == 0) {
            return userInfo.accumulatedYield;
        }
        
        uint256 timeElapsed = block.timestamp - userInfo.lastUpdateTimestamp;
        uint256 pending = timeElapsed * YIELD_RATE_PER_SECOND * userInfo.balance;
        
        return userInfo.accumulatedYield + pending;
    }

    function claimYield() external {
        // TODO: Implement logic
        _updateYield(msg.sender);
        
        uint256 yieldToClaim = users[msg.sender].accumulatedYield;
        if (yieldToClaim == 0) revert ZeroAmount();
        
        users[msg.sender].accumulatedYield = 0;
        
        // Transfere o yield para o usuário
        SafeERC20.safeTransfer(token, msg.sender, yieldToClaim);
        
        emit YieldClaimed(msg.sender, yieldToClaim);
    }

    function withdraw(uint256 amount) external {
        // TODO: Implement logic
        if (amount == 0) revert ZeroAmount();
        
        UserInfo storage userInfo = users[msg.sender];
        if (amount > userInfo.balance) revert InsufficientBalance();
        
        // Atualiza yield antes de mudar o saldo
        _updateYield(msg.sender);
        
        // Atualiza o saldo
        userInfo.balance -= amount;
        
        // Transfere tokens de volta para o usuário
        SafeERC20.safeTransfer(token, msg.sender, amount);
        
        emit Withdrawn(msg.sender, amount);
    }
}
