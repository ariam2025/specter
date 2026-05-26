// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title StakingTreasuryBurn
 * @notice Simple staking treasury for an external ERC20 token.
 *         On stake, a configurable percentage is "burned" by sending to a burn address.
 *         Users' stake accounting is net-of-burn (only what remains in the treasury is credited).
 */
contract StakingTreasuryBurn is Ownable, ReentrancyGuard {
  using SafeERC20 for IERC20;

  uint16 public constant MAX_BPS = 10_000;

  IERC20 public immutable stakingToken;

  address public burnAddress;
  uint16 public burnBps; // 0..10000

  uint256 public totalStaked;
  mapping(address => uint256) public stakedBalance;

  event Staked(address indexed user, uint256 amountIn, uint256 burned, uint256 credited);
  event Withdrawn(address indexed user, uint256 amountOut);
  event BurnConfigUpdated(address indexed burnAddress, uint16 burnBps);
  event Swept(address indexed token, address indexed to, uint256 amount);

  error ZeroAmount();
  error InvalidBps(uint16 bps);
  error InvalidAddress();
  error InsufficientStake(uint256 requested, uint256 available);

  constructor(address _stakingToken, address _owner, address _burnAddress, uint16 _burnBps) Ownable(_owner) {
    if (_stakingToken == address(0) || _owner == address(0)) revert InvalidAddress();
    if (_burnAddress == address(0)) revert InvalidAddress();
    if (_burnBps > MAX_BPS) revert InvalidBps(_burnBps);

    stakingToken = IERC20(_stakingToken);
    burnAddress = _burnAddress;
    burnBps = _burnBps;
  }

  function setBurnConfig(address _burnAddress, uint16 _burnBps) external onlyOwner {
    if (_burnAddress == address(0)) revert InvalidAddress();
    if (_burnBps > MAX_BPS) revert InvalidBps(_burnBps);
    burnAddress = _burnAddress;
    burnBps = _burnBps;
    emit BurnConfigUpdated(_burnAddress, _burnBps);
  }

  function stake(uint256 amount) external nonReentrant {
    if (amount == 0) revert ZeroAmount();

    stakingToken.safeTransferFrom(msg.sender, address(this), amount);

    uint256 burned = (amount * burnBps) / MAX_BPS;
    uint256 credited = amount - burned;

    if (burned != 0) {
      stakingToken.safeTransfer(burnAddress, burned);
    }

    stakedBalance[msg.sender] += credited;
    totalStaked += credited;

    emit Staked(msg.sender, amount, burned, credited);
  }

  function withdraw(uint256 amount) external nonReentrant {
    if (amount == 0) revert ZeroAmount();
    uint256 bal = stakedBalance[msg.sender];
    if (amount > bal) revert InsufficientStake(amount, bal);

    stakedBalance[msg.sender] = bal - amount;
    totalStaked -= amount;

    stakingToken.safeTransfer(msg.sender, amount);
    emit Withdrawn(msg.sender, amount);
  }

  function withdrawAll() external nonReentrant {
    uint256 amount = stakedBalance[msg.sender];
    if (amount == 0) revert ZeroAmount();

    stakedBalance[msg.sender] = 0;
    totalStaked -= amount;

    stakingToken.safeTransfer(msg.sender, amount);
    emit Withdrawn(msg.sender, amount);
  }

  /**
   * @notice Sweep tokens accidentally sent here.
   *         Does not allow sweeping the stakingToken below totalStaked.
   */
  function sweep(address token, address to, uint256 amount) external onlyOwner {
    if (token == address(0) || to == address(0)) revert InvalidAddress();
    if (amount == 0) revert ZeroAmount();

    if (token == address(stakingToken)) {
      uint256 bal = stakingToken.balanceOf(address(this));
      // Keep enough backing for stakers.
      if (bal < totalStaked) revert("INVARIANT_BAL_LT_TOTAL");
      uint256 excess = bal - totalStaked;
      require(amount <= excess, "AMOUNT_GT_EXCESS");
    }

    IERC20(token).safeTransfer(to, amount);
    emit Swept(token, to, amount);
  }
}

