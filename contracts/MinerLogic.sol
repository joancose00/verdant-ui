// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Factory.sol";
import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

interface IStorageCore {
    struct MinerType {
        uint8 rarity;
        uint8 initialLives;
        uint8 initialShields;
        uint8 shieldsCapacity;
    }
    struct Miner {
        address owner;
        uint8 minerType;
        uint8 lives;
        uint8 shields;
        uint64 lastMaintenance;
        uint64 lastReward;
        uint64 gracePeriodEnd;
    }
    struct GiftMiner {
        address recipient;
        uint8 minerType;
        bool claimed;
    }

    function bloomRate() external view returns (uint256);
    function verditeRate() external view returns (uint256);
    function taxPercentage() external view returns (uint16);
    function referralPercentage() external view returns (uint16);
    function verdantToken() external view returns (address);
    function totalMinerTypes() external view returns (uint8);
    function miners(uint256 _minerId) external view returns (Miner memory);
    function minerTypes(uint8 _typeId) external view returns (MinerType memory);
    function giftMiners(uint256 _giftMinerId) external view returns (GiftMiner memory);
    function bloomBalances(address _player) external view returns (uint256);
    function verditeBalances(address _player) external view returns (uint256);
    function referrers(address _player) external view returns (address);
    function playerMinerCount(address _player, uint8 _rarity) external view returns (uint8);
    function playerExpansionSlots(address _player, uint8 _rarity) external view returns (uint8);
    function getAllPlayerMiners(address _player) external view returns (uint256[] memory);
    function getAllPlayerGiftMiners(address _player) external view returns (uint256[] memory);
    function setMinerType(uint8 _typeId, uint8 _rarity, uint8 _lives, uint8 _initialShields, uint8 _shieldsCapacity) external;
    function setReferrer(address _player, address _referrer) external;
    function updateMinerLastMaintenance(uint256 _minerId, uint64 _timestamp) external;
    function updateMinerLastReward(uint256 _minerId, uint64 _timestamp) external;
    function updateMinerLives(uint256 _minerId, uint8 _lives) external;
    function updateBloomBalance(address _player, uint256 _amount, bool _isAddition) external;
    function updateVerditeBalance(address _player, uint256 _amount, bool _isAddition) external;
    function receiveVerdant(address _player, uint256 _amount, uint256 _tax) external;
    function sendVerdant(address _player, uint256 _amount, uint256 _tax) external;
    function createMiner(address _owner, uint8 _minerType) external returns (uint256);
    function replaceMiner(address _owner, uint8 _minerType, uint256 _minerId) external;
    function createMinerFromGift(uint256 _giftMinerId) external returns (uint256);
    function replaceMinerFromGift(uint256 _giftMinerId, uint256 _minerId) external;
}

/*
 * @author ~ 🅧🅘🅟🅩🅔🅡 ~
 *
 * ██╗░░░██╗███████╗██████╗░██████╗░░█████╗░███╗░░██╗████████╗
 * ██║░░░██║██╔════╝██╔══██╗██╔══██╗██╔══██╗████╗░██║╚══██╔══╝
 * ╚██╗░██╔╝█████╗░░██████╔╝██║░░██║███████║██╔██╗██║░░░██║░░░
 * ░╚████╔╝░██╔══╝░░██╔══██╗██║░░██║██╔══██║██║╚████║░░░██║░░░
 * ░░╚██╔╝░░███████╗██║░░██║██████╔╝██║░░██║██║░╚███║░░░██║░░░
 * ░░░╚═╝░░░╚══════╝╚═╝░░╚═╝╚═════╝░╚═╝░░╚═╝╚═╝░░╚══╝░░░╚═╝░░░
 * Description: The Official Verdant World Miner Logic Contract
 *
 * X: https://x.com/ProjectVerdant
 * Telegram: https://t.me/ProjectVerdant
 * Website: https://projectverdant.com
*/
contract MinerLogic is Ownable {
    using Math for uint256;

    uint32 public constant MAINTENANCE_WINDOW = 7 days;

    uint8 public constant PROMOTIONAL = 0;
    uint8 public constant COMMON = 1;
    uint8 public constant RARE = 2;
    uint8 public constant MYTHIC = 3;

    uint8 public constant STARTER_MINER = 0;
    uint8 public constant BASIC_MINER = 1;
    uint8 public constant ADVANCED_MINER = 2;
    uint8 public constant ELITE_MINER = 3;

    uint16 public constant STARTER_REWARDS_DIVISOR = 180;
    uint16 public constant BASIC_REWARDS_DIVISOR = 90;
    uint16 public constant ADVANCED_REWARDS_DIVISOR = 60;
    uint16 public constant ELITE_REWARDS_DIVISOR = 30;
    
    uint16 public constant STARTER_CAPACITY_DIVISOR = 15;
    uint16 public constant BASIC_CAPACITY_DIVISOR = 20;
    uint16 public constant ADVANCED_CAPACITY_DIVISOR = 25;
    uint16 public constant ELITE_CAPACITY_DIVISOR = 30;

    uint8 public constant PROMOTIONAL_DEFAULT_CAPACITY = 3;
    uint8 public constant COMMON_DEFAULT_CAPACITY = 5;
    uint8 public constant RARE_DEFAULT_CAPACITY = 3;
    uint8 public constant MYTHIC_DEFAULT_CAPACITY = 1;
    
    uint8 public constant PROMOTIONAL_MAX_CAPACITY = 3;
    uint8 public constant COMMON_MAX_CAPACITY = 20;
    uint8 public constant RARE_MAX_CAPACITY = 15;
    uint8 public constant MYTHIC_MAX_CAPACITY = 10;

    IStorageCore public immutable storageCore;
    IERC20 public immutable verdantToken;
    address public liquidityPair;
    
    event MinerDestroyed(address indexed player, uint256 indexed minerId);
    event ReferralReward(address indexed referrer, address indexed player, uint256 amount);
    
    /**
     * @dev Initializes the MinerLogic contract
     * @param _storageCore Address of the StorageCore contract
     */
    constructor(address _storageCore) Ownable(msg.sender) {
        storageCore = IStorageCore(_storageCore);
        verdantToken = IERC20(storageCore.verdantToken());
    }

    /**
     * @dev Sets up the default miner types (Starter, Basic, Advanced, Elite)
     */
    function setupDefaultMinerTypes() external onlyOwner {
        storageCore.setMinerType(STARTER_MINER, PROMOTIONAL, 2, 1, 2);
        storageCore.setMinerType(BASIC_MINER, COMMON, 2, 2, 4);
        storageCore.setMinerType(ADVANCED_MINER, RARE, 2, 2, 4);
        storageCore.setMinerType(ELITE_MINER, MYTHIC, 2, 2, 4);
    }

    /**
     * @dev Sets up the Uniswap liquidity pair for price calculations
     * @param _verdantToken Address of the Verdant token
     */
    function setupLiquidityPair(address _verdantToken, address _uniswapRouter) public onlyOwner {
        IUniswapV2Factory uniswapFactory = IUniswapV2Factory(IUniswapV2Router02(_uniswapRouter).factory());
        address weth = IUniswapV2Router02(_uniswapRouter).WETH();
        liquidityPair = uniswapFactory.getPair(_verdantToken, weth);
        if (liquidityPair == address(0)) {
            liquidityPair = uniswapFactory.getPair(weth, _verdantToken);
            require(liquidityPair != address(0), "Liquidity pair not found");
        }
    }
    
    /**
     * @dev Retrieves the current amount of Verdant tokens in the liquidity pool
     * @return Amount of Verdant tokens in the pool
     */
    function getVerdantInLiquidityPool() public view returns (uint256) {
        if (liquidityPair == address(0)) {
            return 0;
        }
        return verdantToken.balanceOf(liquidityPair);
    }

    /**
     * @dev Retrieves information about all purchasable miners
     * @return minerTypes Array of miner type IDs
     * @return rarities Array of rarity values for each miner type
     * @return lives Array of initial lives for each miner type
     * @return shields Array of initial shields for each miner type
     * @return costs Array of purchase costs in Bloom for each miner type
     * @return dailyRewards Array of daily rewards rates for each miner type
     * @return rewardsCapacities Array of rewards capacities for each miner type
     */
    function getMarketMiners() external view returns (
        uint8[] memory minerTypes,
        uint8[] memory rarities,
        uint8[] memory lives,
        uint8[] memory shields,
        uint256[] memory costs,
        uint256[] memory dailyRewards,
        uint256[] memory rewardsCapacities,
        uint256[] memory maintenanceCosts
    ) {
        uint8 totalMinerTypes = storageCore.totalMinerTypes();
        
        uint8 purchasableCount = 0;
        for (uint8 i = 0; i < totalMinerTypes; i++) {
            IStorageCore.MinerType memory minerType = storageCore.minerTypes(i);
            if (minerType.rarity != PROMOTIONAL) {
                purchasableCount++;
            }
        }
        
        minerTypes = new uint8[](purchasableCount);
        rarities = new uint8[](purchasableCount);
        lives = new uint8[](purchasableCount);
        shields = new uint8[](purchasableCount);
        costs = new uint256[](purchasableCount);
        dailyRewards = new uint256[](purchasableCount);
        rewardsCapacities = new uint256[](purchasableCount);
        maintenanceCosts = new uint256[](purchasableCount);

        uint8 index = 0;
        for (uint8 i = 0; i < totalMinerTypes; i++) {
            IStorageCore.MinerType memory minerType = storageCore.minerTypes(i);
            
            if (minerType.rarity != PROMOTIONAL) {
                minerTypes[index] = i;
                rarities[index] = minerType.rarity;
                lives[index] = minerType.initialLives;
                shields[index] = minerType.initialShields;
                
                uint256 cost = calculateMinerBloomCost(i);
                costs[index] = cost;
                
                uint256 dailyReward = calculateRewardsRate(i, cost);
                dailyRewards[index] = dailyReward;
                
                rewardsCapacities[index] = calculateRewardsCapacity(i, dailyReward);
                maintenanceCosts[index] = calculateMaintenanceCost(dailyReward);
                index++;
            }
        }
        
        return (minerTypes, rarities, lives, shields, costs, dailyRewards, rewardsCapacities, maintenanceCosts);
    }

    /**
     * @dev Retrieves detailed information about all miners owned by a player
     * @param _player Address of the player
     * @return minerIds Array of miner IDs owned by the player
     * @return minerTypes Array of miner type IDs
     * @return rarities Array of rarity values for each miner
     * @return lives Array of current lives for each miner
     * @return shields Array of current shield values for each miner
     * @return lastMaintenance Array of timestamps for last maintenance of each miner
     * @return lastReward Array of timestamps for last reward claim of each miner
     * @return gracePeriodEnd Array of timestamps for grace period end of each miner
     * @return pendingRewards Array of pending rewards for each miner
     * @return maintenanceCosts Array of current maintenance costs for each miner
     */
    function getPlayerMiners(address _player) external view returns (
        uint256[] memory minerIds,
        uint8[] memory minerTypes,
        uint8[] memory rarities,
        uint8[] memory lives,
        uint8[] memory shields,
        uint64[] memory lastMaintenance,
        uint64[] memory lastReward,
        uint64[] memory gracePeriodEnd,
        uint256[] memory pendingRewards,
        uint256[] memory maintenanceCosts
    ) {
        minerIds = storageCore.getAllPlayerMiners(_player);
        uint256 length = minerIds.length;
        minerTypes = new uint8[](length);
        rarities = new uint8[](length);
        lives = new uint8[](length);
        shields = new uint8[](length);
        lastMaintenance = new uint64[](length);
        lastReward = new uint64[](length);
        gracePeriodEnd = new uint64[](length);
        pendingRewards = new uint256[](length);
        maintenanceCosts = new uint256[](length);

        for (uint256 i = 0; i < length; i++) {
            IStorageCore.Miner memory miner = storageCore.miners(minerIds[i]);
            IStorageCore.MinerType memory minerTypeData = storageCore.minerTypes(miner.minerType);
            
            minerTypes[i] = miner.minerType;
            rarities[i] = minerTypeData.rarity;
            lives[i] = calculateMinerLives(miner);
            shields[i] = miner.shields;
            lastMaintenance[i] = miner.lastMaintenance;
            lastReward[i] = miner.lastReward;
            gracePeriodEnd[i] = miner.gracePeriodEnd;
            
            uint256 timeElapsed = block.timestamp - miner.lastMaintenance;
            uint256 maintenanceWindow = MAINTENANCE_WINDOW;
            
            pendingRewards[i] = calculateRewards(miner);
            
            uint256 bloomCost = calculateMinerBloomCost(miner.minerType);
            uint256 rewardsRate = calculateRewardsRate(miner.minerType, bloomCost);
            uint256 baseCost = calculateMaintenanceCost(rewardsRate);
            maintenanceCosts[i] = (baseCost * timeElapsed) / maintenanceWindow;
        }
        
        return (
            minerIds,
            minerTypes,
            rarities,
            lives,
            shields,
            lastMaintenance,
            lastReward,
            gracePeriodEnd,
            pendingRewards,
            maintenanceCosts
        );
    }
    
    /**
     * @dev Retrieves information about all unclaimed miners in a player's gift inventory
     * @param _player Address of the player
     * @return giftMinerIds Array of unclaimed gift miner IDs
     * @return minerTypes Array of miner type IDs
     * @return rarities Array of rarity values for each miner
     */
    function getPlayerGiftMiners(address _player) external view returns (
        uint256[] memory giftMinerIds,
        uint8[] memory minerTypes,
        uint8[] memory rarities
    ) {
        giftMinerIds = storageCore.getAllPlayerGiftMiners(_player);
        uint256 giftMinerCount = giftMinerIds.length;
        
        minerTypes = new uint8[](giftMinerCount);
        rarities = new uint8[](giftMinerCount);
        
        for (uint256 i = 0; i < giftMinerCount; i++) {
            IStorageCore.GiftMiner memory giftMiner = storageCore.giftMiners(giftMinerIds[i]);
            minerTypes[i] = giftMiner.minerType;
            rarities[i] = storageCore.minerTypes(giftMiner.minerType).rarity;
        }
        
        return (giftMinerIds, minerTypes, rarities);
    }

    /**
     * @dev Calculates the number of available slots for a player based on their rarity
     * @param _player Address of the player
     * @param _rarity Rarity of the miner
     * @return Number of available slots
     */
    function calculateAvailableSlots(address _player, uint8 _rarity) public view returns (uint8) {
        uint8 baseCapacity;

        if (_rarity == PROMOTIONAL) {
            baseCapacity = PROMOTIONAL_DEFAULT_CAPACITY;
        } else if (_rarity == COMMON) {
            baseCapacity = COMMON_DEFAULT_CAPACITY;
        } else if (_rarity == RARE) {
            baseCapacity = RARE_DEFAULT_CAPACITY;
        } else if (_rarity == MYTHIC) {
            baseCapacity = MYTHIC_DEFAULT_CAPACITY;
        } else {
            revert("Invalid rarity");
        }

        return (storageCore.playerExpansionSlots(_player, _rarity) + baseCapacity) - storageCore.playerMinerCount(_player, _rarity);
    }

    /**
     * @dev Calculates the daily rewards rate for a miner type based on bloom cost
     * @param _minerType The type of miner
     * @param _bloomCost The bloom cost of the miner
     * @return The daily rewards rate for the miner type
     */
    function calculateRewardsRate(uint8 _minerType, uint256 _bloomCost) public view returns (uint256) {        
        uint16 divisor;
        if (_minerType == STARTER_MINER) {
            divisor = STARTER_REWARDS_DIVISOR;
        } else if (_minerType == BASIC_MINER) {
            divisor = BASIC_REWARDS_DIVISOR;
        } else if (_minerType == ADVANCED_MINER) {
            divisor = ADVANCED_REWARDS_DIVISOR;
        } else if (_minerType == ELITE_MINER) {
            divisor = ELITE_REWARDS_DIVISOR;
        } else {
            revert("Invalid miner type");
        }
        return (_bloomCost * (storageCore.verditeRate() / storageCore.bloomRate())) / divisor;
    }
    
    /**
     * @dev Calculates the rewards capacity for a miner type based on daily rewards
     * @param _minerType The type of miner
     * @param _dailyRewards The daily rewards of the miner
     * @return The rewards capacity for the miner type
     */
    function calculateRewardsCapacity(uint8 _minerType, uint256 _dailyRewards) public pure returns (uint256) {
        uint16 divisor;
        if (_minerType == STARTER_MINER) {
            divisor = STARTER_CAPACITY_DIVISOR;
        } else if (_minerType == BASIC_MINER) {
            divisor = BASIC_CAPACITY_DIVISOR;
        } else if (_minerType == ADVANCED_MINER) {
            divisor = ADVANCED_CAPACITY_DIVISOR;
        } else if (_minerType == ELITE_MINER) {
            divisor = ELITE_CAPACITY_DIVISOR;
        } else {
            revert("Invalid miner type");
        }
        return (_dailyRewards * 10) / divisor;
    }

    /**
     * @dev Calculates the bloom cost to purchase a miner
     * @param _minerType The type of miner to purchase
     * @return Cost in Bloom tokens
     */
    function calculateMinerBloomCost(uint8 _minerType) public view returns (uint256) {
        uint256 verdantInPool = getVerdantInLiquidityPool();
        uint256 bloomRate = storageCore.bloomRate();
        
        if (_minerType == STARTER_MINER) {
            uint256 dynamicCost = (verdantInPool * 10) / 100000;
            return Math.min(dynamicCost * bloomRate, 50000000000000000000000);
        } else if (_minerType == BASIC_MINER) {
            uint256 dynamicCost = (verdantInPool * 75) / 100000;
            return Math.min(dynamicCost * bloomRate, 500000000000000000000000);
        } else if (_minerType == ADVANCED_MINER) {
            uint256 dynamicCost = (verdantInPool * 3) / 1000;
            return Math.min(dynamicCost * bloomRate, 5000000000000000000000000);
        } else if (_minerType == ELITE_MINER) {
            uint256 dynamicCost = (verdantInPool * 15) / 1000;
            return Math.min(dynamicCost * bloomRate, 50000000000000000000000000);
        }
        revert("Invalid miner type");
    }

    /**
     * @dev Calculates the current number of lives for a miner
     * @param miner The miner data
     * @return Current number of lives accounting for missed maintenance windows
     */
    function calculateMinerLives(IStorageCore.Miner memory miner) public view returns (uint8) {
        if (miner.lives == 0) return 0;
        
        uint256 timeSinceLastMaintenance = block.timestamp - miner.lastMaintenance;
        uint256 missedWindows = timeSinceLastMaintenance / MAINTENANCE_WINDOW;
        if (missedWindows >= miner.lives) return 0;
        return uint8(miner.lives - missedWindows);
    }

    /**
     * @dev Calculates accumulated rewards for a miner
     * @param miner The miner data
     * @return Amount of Verdite rewards accumulated
     */
    function calculateRewards(IStorageCore.Miner memory miner) public view returns (uint256) {
        uint8 lives = calculateMinerLives(miner);
        if (lives == 0 || miner.shields == 0) {
            return 0;
        }

        uint256 bloomCost = calculateMinerBloomCost(miner.minerType);
        uint256 rewardsRate = calculateRewardsRate(miner.minerType, bloomCost);
        uint256 timeSinceLastReward = block.timestamp - miner.lastReward;
        uint256 rewards = (rewardsRate * timeSinceLastReward) / 1 days;
        
        uint256 capacity = calculateRewardsCapacity(miner.minerType, rewardsRate);
        
        return Math.min(rewards, capacity);
    }

    /**
     * @dev Calculates the maintenance cost based on daily rewards
     * @param _dailyRewards Daily rewards rate in Verdite
     * @return Maintenance cost in Bloom
     */
    function calculateMaintenanceCost(uint256 _dailyRewards) public view returns (uint256) {
        uint256 weeklyRewards = _dailyRewards * (MAINTENANCE_WINDOW / 86400);
        return (weeklyRewards / 10) / (storageCore.verditeRate() / storageCore.bloomRate());
    }

    /**
     * @dev Finds a replacement miner slot for a player
     * @param _player Address of the player
     * @param _rarity Rarity of the miner
     * @return ID of the replacement slot or 0 if no replacement slot is found
     */
    function findReplacementSlot(address _player, uint8 _rarity) internal view returns (uint256) {
        uint256[] memory minerIds = storageCore.getAllPlayerMiners(_player);
        for (uint256 i = 0; i < minerIds.length; i++) {
            IStorageCore.Miner memory miner = storageCore.miners(minerIds[i]);
            if (storageCore.minerTypes(miner.minerType).rarity == _rarity) {
                uint8 lives = calculateMinerLives(miner);
                if (lives == 0) {
                    return minerIds[i];
                }
            }
        }
        for (uint256 i = 0; i < minerIds.length; i++) {
            IStorageCore.Miner memory miner = storageCore.miners(minerIds[i]);
            if (storageCore.minerTypes(miner.minerType).rarity == _rarity) {
                if (miner.shields == 0) {
                    return minerIds[i];
                }
            }
        }
        return 0;
    }

    /**
     * @dev Purchases a new miner of the specified type
     * @param _minerType The type of miner to purchase
     * @return ID of the newly created miner
     */
    function purchaseMiner(uint8 _minerType) external returns (uint256) {
        require(_minerType != PROMOTIONAL, "Cannot purchase promotional miner");
        require(_minerType < storageCore.totalMinerTypes(), "Invalid miner type");
        uint256 minerCost = calculateMinerBloomCost(_minerType);
        uint8 minerRarity = storageCore.minerTypes(_minerType).rarity;
        uint8 availableSlots = calculateAvailableSlots(msg.sender, minerRarity);
        if (availableSlots == 0) {
            uint256 minerId = findReplacementSlot(msg.sender, minerRarity);
            require(minerId != 0, "No available slots");
            storageCore.updateBloomBalance(msg.sender, minerCost, false);
            storageCore.replaceMiner(msg.sender, _minerType, minerId);
            return minerId;
        }
        storageCore.updateBloomBalance(msg.sender, minerCost, false);
        return storageCore.createMiner(msg.sender, _minerType);
    }

    /**
     * @dev Purchases Bloom tokens using Verdant tokens
     * @param _amount Amount of Verdant tokens to spend
     * @param _referrer Address of the referrer (if any)
     * @return Amount of Bloom tokens received after tax
     */
    function purchaseBloom(uint256 _amount, address _referrer) external returns (uint256) {
        require(_amount > 0, "Amount must be greater than 0");
        
        uint256 bloomAmount = _amount * storageCore.bloomRate();
        uint256 tax = (bloomAmount * storageCore.taxPercentage()) / 10000;
        uint256 afterTax = bloomAmount - tax;
        
        uint256 taxAmount = (_amount * storageCore.taxPercentage()) / 10000;
        
        storageCore.receiveVerdant(msg.sender, _amount, taxAmount);
        storageCore.updateBloomBalance(msg.sender, afterTax, true);

        if (storageCore.referrers(msg.sender) == address(0)) {
            if (_referrer != msg.sender && _referrer != address(0)) {
                storageCore.setReferrer(msg.sender, _referrer);
                distributeReferral(afterTax);
            }
        }
        else {
            distributeReferral(afterTax);
        }
        
        return afterTax;
    }

    /**
     * @dev Refines Verdite into Verdant tokens
     * @param _amount Amount of Verdite to refine
     * @return Amount of Verdant tokens received after tax
     */
    function refineVerdite(uint256 _amount) external returns (uint256) {
        require(_amount > 0, "Amount must be greater than 0");
        require(storageCore.verditeBalances(msg.sender) >= _amount, "Insufficient Verdite balance");
        
        uint256 verdantAmount = _amount / storageCore.verditeRate();
        uint256 tax = (verdantAmount * storageCore.taxPercentage()) / 10000;
        uint256 afterTax = verdantAmount - tax;
        
        storageCore.updateVerditeBalance(msg.sender, _amount, false);
        storageCore.sendVerdant(msg.sender, afterTax, tax);
        
        return afterTax;
    }

    /**
     * @dev Claims accumulated rewards from a miner
     * @param _minerId ID of the miner to claim rewards from
     * @return Amount of Verdite rewards claimed
     */
    function claimRewards(uint256 _minerId) external returns (uint256) {
        IStorageCore.Miner memory miner = storageCore.miners(_minerId);
        require(miner.owner == msg.sender, "Not the miner owner");
        require(miner.lives > 0, "Miner has no lives left");
        require(miner.shields > 0, "Miner is disabled");

        updateMinerState(miner, _minerId);
        uint256 rewards = calculateRewards(miner);
        require(rewards > 0, "No rewards to claim");
        
        storageCore.updateVerditeBalance(msg.sender, rewards, true);
        storageCore.updateMinerLastReward(_minerId, uint64(block.timestamp));
        return rewards;
    }

    /**
     * @dev Performs maintenance on a miner to maintain its lives
     * @param _minerId ID of the miner to maintain
     */
    function maintainMiner(uint256 _minerId) external {
        IStorageCore.Miner memory miner = storageCore.miners(_minerId);
        require(miner.owner == msg.sender, "Not the miner owner");
        require(miner.lives > 0, "Miner has no lives left");
        require(miner.shields > 0, "Miner is disabled");

        updateMinerState(miner, _minerId);

        uint256 bloomCost = calculateMinerBloomCost(miner.minerType);
        uint256 rewardsRate = calculateRewardsRate(miner.minerType, bloomCost);
        uint256 timeElapsed = block.timestamp - miner.lastMaintenance;
        uint256 baseCost = calculateMaintenanceCost(rewardsRate);
        uint256 maintenanceCost = (baseCost * timeElapsed) / MAINTENANCE_WINDOW;

        require(storageCore.bloomBalances(msg.sender) >= maintenanceCost, "Insufficient Bloom for maintenance");

        storageCore.updateBloomBalance(msg.sender, maintenanceCost, false);
        storageCore.updateMinerLastMaintenance(_minerId, uint64(block.timestamp));
    }

    /**
     * @dev Claims a gifted miner and adds it to player's inventory
     * @param _giftMinerId ID of the gifted miner to claim
     * @return ID of the newly created miner
     */
    function claimGiftMiner(uint256 _giftMinerId) external returns (uint256) {
        IStorageCore.GiftMiner memory giftMiner = storageCore.giftMiners(_giftMinerId);
        require(giftMiner.recipient == msg.sender, "Not the gift recipient");
        require(giftMiner.claimed == false, "Gift miner already claimed");
        uint8 minerRarity = storageCore.minerTypes(giftMiner.minerType).rarity;
        uint8 availableSlots = calculateAvailableSlots(msg.sender, minerRarity);
        if (availableSlots == 0) {
            uint256 minerId = findReplacementSlot(msg.sender, minerRarity);
            require(minerId != 0, "No available slots");
            storageCore.replaceMinerFromGift(_giftMinerId, minerId);
            return minerId;
        }
        return storageCore.createMinerFromGift(_giftMinerId);
    }

    /**
     * @dev Updates the state of a miner based on maintenance status
     * @param miner Miner data to update
     * @param _minerId ID of the miner to update
     */
    function updateMinerState(IStorageCore.Miner memory miner, uint256 _minerId) internal {         
        uint256 maintenanceWindow = MAINTENANCE_WINDOW;
        uint256 deadline = miner.lastMaintenance + maintenanceWindow;

        if (block.timestamp > deadline) {
            uint256 missedWindows = (block.timestamp - miner.lastMaintenance) / maintenanceWindow;
            if (missedWindows >= miner.lives) {
                storageCore.updateMinerLives(_minerId, 0);
                emit MinerDestroyed(msg.sender, _minerId);
            } else {
                uint8 newLives = miner.lives - uint8(missedWindows);
                storageCore.updateMinerLives(_minerId, newLives);
                storageCore.updateMinerLastMaintenance(_minerId, uint64(miner.lastMaintenance + (missedWindows * maintenanceWindow)));
            }
        }
    }

    /**
     * @dev Distributes referral rewards to the referrer
     * @param _amount Amount on which to calculate referral reward
     */
    function distributeReferral(uint256 _amount) internal {
        address referrer = storageCore.referrers(msg.sender);
        if (referrer != address(0)) {
            uint256 referralAmount = (_amount * storageCore.referralPercentage()) / 10000;
            if (referralAmount > 0) {
                storageCore.updateBloomBalance(referrer, referralAmount, true);
                emit ReferralReward(referrer, msg.sender, referralAmount);
            }
        }
    }
}