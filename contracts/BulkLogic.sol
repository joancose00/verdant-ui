// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "@openzeppelin/contracts/access/Ownable.sol";

interface IStorageCore {
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

    struct GiftItem {
        address recipient;
        uint8 itemType;
        uint16 quantity;
        bool claimed;
    }

    struct Item {
        address owner;
        uint8 itemType;
        uint16 quantity;
    }

    struct ItemType {
        uint8 effect;
        uint8 rarity;
        uint8 maxQuantity;
    }

    struct MinerType {
        uint8 rarity;
        uint8 initialLives;
        uint8 initialShields;
        uint8 shieldsCapacity;
    }

    function getAllPlayerMiners(address _player) external view returns (uint256[] memory);
    function getAllPlayerItems(address _player) external view returns (uint256[] memory);
    function getAllPlayerGiftMiners(address _player) external view returns (uint256[] memory);
    function getAllPlayerGiftItems(address _player) external view returns (uint256[] memory);
    function miners(uint256 _minerId) external view returns (Miner memory);
    function minerTypes(uint8 _typeId) external view returns (MinerType memory);
    function giftMiners(uint256 _giftMinerId) external view returns (GiftMiner memory);
    function items(uint256 _itemId) external view returns (Item memory);
    function itemTypes(uint8 _typeId) external view returns (ItemType memory);
    function giftItems(uint256 _giftItemId) external view returns (GiftItem memory);
    function bloomBalances(address _player) external view returns (uint256);
    function updateMinerLastMaintenance(uint256 _minerId, uint64 _timestamp) external;
    function updateMinerLastReward(uint256 _minerId, uint64 _timestamp) external;
    function updateMinerLives(uint256 _minerId, uint8 _lives) external;
    function updateItemQuantity(uint256 _itemId, uint16 _quantity) external;
    function updateBloomBalance(address _player, uint256 _amount, bool _isAddition) external;
    function updateVerditeBalance(address _player, uint256 _amount, bool _isAddition) external;
    function createMinerFromGift(uint256 _giftMinerId) external returns (uint256);
    function replaceMinerFromGift(uint256 _giftMinerId, uint256 _minerId) external;
    function createItemFromGift(uint256 _giftItemId) external returns (uint256);
    function updateItemFromGift(uint256 _giftItemId, uint256 _itemId) external;
}

interface IMinerLogic {
    function calculateMinerBloomCost(uint8 _minerType) external view returns (uint256);
    function calculateRewardsRate(uint8 _minerType, uint256 _bloomCost) external view returns (uint256);
    function calculateMaintenanceCost(uint256 _dailyRewards) external view returns (uint256);
    function calculateAvailableSlots(address _player, uint8 _rarity) external view returns (uint8);
    function calculateMinerLives(IStorageCore.Miner memory _miner) external view returns (uint8);
    function calculateRewards(IStorageCore.Miner memory _miner) external view returns (uint256);
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
 * Description: The Official Verdant World Bulk Logic Contract
 *
 * X: https://x.com/ProjectVerdant
 * Telegram: https://t.me/ProjectVerdant
 * Website: https://projectverdant.com
*/
contract BulkLogic is Ownable {
    IStorageCore public storageCore;
    IMinerLogic public minerLogic;
    
    uint256 constant MAINTENANCE_WINDOW = 7 days;

    event MinerDestroyed(address indexed player, uint256 minerId);
    
    constructor(address _storageCore, address _minerLogic) Ownable(msg.sender) {
        storageCore = IStorageCore(_storageCore);
        minerLogic = IMinerLogic(_minerLogic);
    }
    
    /**
     * @dev Finds replacement slots for miners of specified rarities
     * @param _player Address of the player
     * @param _rarities Array of rarities to find replacement slots for
     * @return Array of miner IDs that can be replaced, 0 if no replacement found
     */
    function findReplacementSlots(address _player, uint8[] memory _rarities) internal view returns (uint256[] memory) {
        uint256[] memory slots = new uint256[](_rarities.length);
        uint256[] memory playerMiners = storageCore.getAllPlayerMiners(_player);

        uint256 lastRarityIndex = 0;
        
        for (uint256 i = 0; i < _rarities.length; i++) {
            for (uint256 j = 0; j < playerMiners.length; j++) {
                IStorageCore.Miner memory miner = storageCore.miners(playerMiners[j]);                
                if (storageCore.minerTypes(miner.minerType).rarity == _rarities[i]) {
                    uint8 lives = minerLogic.calculateMinerLives(miner);
                    if (lives == 0) {
                        slots[i] = playerMiners[j];
                        lastRarityIndex = i + 1;
                        break;
                    }
                }
            }
        }
        
        for (lastRarityIndex; lastRarityIndex < _rarities.length; lastRarityIndex++) {
            for (uint256 j = 0; j < playerMiners.length; j++) {
                IStorageCore.Miner memory miner = storageCore.miners(playerMiners[j]);                
                if (storageCore.minerTypes(miner.minerType).rarity == _rarities[lastRarityIndex]) {
                    if (miner.shields == 0) {
                        slots[lastRarityIndex] = playerMiners[j];
                        break;
                    }
                }
            }
        }
        
        return slots;
    }
    
    /**
     * @dev Finds item slots for items of specified types
     * @param _player Address of the player
     * @param _itemTypes Array of item types to find slots for
     * @return Array of item IDs that can be used, length of player's items if no slot found
     */
    function findItemSlots(address _player, uint256[] memory _itemTypes) internal view returns (uint256[] memory) {
        uint256[] memory slots = new uint256[](_itemTypes.length);
        uint256[] memory playerItems = storageCore.getAllPlayerItems(_player);
        
        for (uint256 i = 0; i < _itemTypes.length; i++) {
            for (uint256 j = 0; j < playerItems.length; j++) {
                IStorageCore.Item memory item = storageCore.items(playerItems[j]);
                if (item.itemType == _itemTypes[i]) {
                    slots[i] = playerItems[j];
                    break;
                }
            }
        }
        
        return slots;
    }
    
    /**
     * @dev Updates the state of a miner based on maintenance status
     * @param _miner Miner data to update
     * @param _minerId ID of the miner to update
     */
    function updateMinerState(IStorageCore.Miner memory _miner, uint256 _minerId) internal {
        uint256 maintenanceWindow = MAINTENANCE_WINDOW;
        uint256 deadline = _miner.lastMaintenance + maintenanceWindow;

        if (block.timestamp > deadline) {
            uint256 missedWindows = (block.timestamp - _miner.lastMaintenance) / maintenanceWindow;
            if (missedWindows >= _miner.lives) {
                storageCore.updateMinerLives(_minerId, 0);
                emit MinerDestroyed(msg.sender, _minerId);
            } else {
                uint8 newLives = _miner.lives - uint8(missedWindows);
                storageCore.updateMinerLives(_minerId, newLives);
                storageCore.updateMinerLastMaintenance(_minerId, uint64(_miner.lastMaintenance + (missedWindows * maintenanceWindow)));
            }
        }
    }
    
    /**
     * @dev Claims multiple gift miners in a single transaction
     * @param _giftMinerIds Array of gift miner IDs to claim
     * @return Array of success/failure results for each claim
     */
    function claimGiftMiners(uint256[] calldata _giftMinerIds) public returns (bool[] memory) {
        uint256[] memory playerGiftMiners = storageCore.getAllPlayerGiftMiners(msg.sender);
        require(_giftMinerIds.length <= playerGiftMiners.length, "Too many gift miners");
        
        bool[] memory results = new bool[](_giftMinerIds.length);
        
        uint8[] memory rarities = new uint8[](_giftMinerIds.length);
        for (uint256 i = 0; i < _giftMinerIds.length; i++) {
            IStorageCore.GiftMiner memory giftMiner = storageCore.giftMiners(_giftMinerIds[i]);
            require(giftMiner.recipient == msg.sender, "Not the gift recipient");
            require(giftMiner.claimed == false, "Gift miner already claimed");
            rarities[i] = storageCore.minerTypes(giftMiner.minerType).rarity;
        }
        
        uint256[] memory slots = findReplacementSlots(msg.sender, rarities);
        
        for (uint256 i = 0; i < _giftMinerIds.length; i++) {
            IStorageCore.GiftMiner memory giftMiner = storageCore.giftMiners(_giftMinerIds[i]);
            uint8 minerRarity = storageCore.minerTypes(giftMiner.minerType).rarity;
            uint8 availableSlots = minerLogic.calculateAvailableSlots(msg.sender, minerRarity);
            
            if (availableSlots == 0) {
                if (slots[i] != 0) {
                    storageCore.replaceMinerFromGift(_giftMinerIds[i], slots[i]);
                    results[i] = true;
                }
                else {
                    results[i] = false;
                }
            } else {
                storageCore.createMinerFromGift(_giftMinerIds[i]);
                results[i] = true;
            }
        }
        
        return results;
    }
    
    /**
     * @dev Claims multiple gift items in a single transaction
     * @param _giftItemIds Array of gift item IDs to claim
     * @return Array of success/failure results for each claim
     */
    function claimGiftItems(uint256[] calldata _giftItemIds) public returns (bool[] memory) {
        uint256[] memory playerGiftItems = storageCore.getAllPlayerGiftItems(msg.sender);
        require(_giftItemIds.length <= playerGiftItems.length, "Too many gift items");
        
        bool[] memory results = new bool[](_giftItemIds.length);
        
        uint256[] memory itemTypes = new uint256[](_giftItemIds.length);
        for (uint256 i = 0; i < _giftItemIds.length; i++) {
            IStorageCore.GiftItem memory giftItem = storageCore.giftItems(_giftItemIds[i]);
            require(giftItem.recipient == msg.sender, "Not the gift recipient");
            require(giftItem.claimed == false, "Gift item already claimed");
            itemTypes[i] = giftItem.itemType;
        }
        
        uint256[] memory slots = findItemSlots(msg.sender, itemTypes);
        
        for (uint256 i = 0; i < _giftItemIds.length; i++) {
            IStorageCore.GiftItem memory giftItem = storageCore.giftItems(_giftItemIds[i]);
            if (slots[i] != 0) {
                uint16 newQuantity = storageCore.items(slots[i]).quantity + giftItem.quantity;
                if (newQuantity > storageCore.itemTypes(giftItem.itemType).maxQuantity) {
                    results[i] = false;
                } else {
                    storageCore.updateItemFromGift(_giftItemIds[i], slots[i]);
                    storageCore.updateItemQuantity(slots[i], newQuantity);
                    results[i] = true;
                }
            } else {
                storageCore.createItemFromGift(_giftItemIds[i]);
                results[i] = true;
            }
        }
        
        return results;
    }
    
    /**
     * @dev Claims multiple gift miners and items in a single transaction
     * @param _giftMinerIds Array of gift miner IDs to claim
     * @param _giftItemIds Array of gift item IDs to claim
     * @return minerResults Array of success/failure results for each miner claim
     * @return itemResults Array of success/failure results for each item claim
     */
    function claimGifts(
        uint256[] calldata _giftMinerIds,
        uint256[] calldata _giftItemIds
    ) external returns (bool[] memory minerResults, bool[] memory itemResults) {
        minerResults = claimGiftMiners(_giftMinerIds);
        itemResults = claimGiftItems(_giftItemIds);
        return (minerResults, itemResults);
    }
    
    /**
     * @dev Maintains multiple miners in a single transaction
     * @param _minerIds Array of miner IDs to maintain
     * @return Array of success/failure results for each maintenance
     */
    function maintainMiners(uint256[] calldata _minerIds) external returns (bool[] memory) {
        uint256[] memory playerMiners = storageCore.getAllPlayerMiners(msg.sender);
        require(_minerIds.length <= playerMiners.length, "Too many miners");
        
        bool[] memory results = new bool[](_minerIds.length);
        
        for (uint256 i = 0; i < _minerIds.length; i++) {
            IStorageCore.Miner memory miner = storageCore.miners(_minerIds[i]);
            require(miner.owner == msg.sender, "Not the miner owner");

            if (miner.lives == 0 || miner.shields == 0) {
                results[i] = false;
                continue;
            }

            updateMinerState(miner, _minerIds[i]);
            
            uint256 bloomCost = minerLogic.calculateMinerBloomCost(miner.minerType);
            uint256 rewardsRate = minerLogic.calculateRewardsRate(miner.minerType, bloomCost);
            uint256 timeElapsed = block.timestamp - miner.lastMaintenance;
            uint256 baseCost = minerLogic.calculateMaintenanceCost(rewardsRate);
            uint256 maintenanceCost = (baseCost * timeElapsed) / MAINTENANCE_WINDOW;

            if (storageCore.bloomBalances(msg.sender) < maintenanceCost) {
                break;
            }
            
            storageCore.updateBloomBalance(msg.sender, maintenanceCost, false);
            storageCore.updateMinerLastMaintenance(_minerIds[i], uint64(block.timestamp));
            results[i] = true;
        }
        
        return results;
    }
    
    /**
     * @dev Claims rewards from multiple miners in a single transaction
     * @param _minerIds Array of miner IDs to claim rewards from
     * @return Total rewards claimed and array of success/failure results
     */
    function claimRewards(uint256[] calldata _minerIds) external returns (uint256, bool[] memory) {
        uint256[] memory playerMiners = storageCore.getAllPlayerMiners(msg.sender);
        require(_minerIds.length <= playerMiners.length, "Too many miners");
        
        bool[] memory results = new bool[](_minerIds.length);
        uint256 totalRewards = 0;
        
        for (uint256 i = 0; i < _minerIds.length; i++) {
            IStorageCore.Miner memory miner = storageCore.miners(_minerIds[i]);
            require(miner.owner == msg.sender, "Not the miner owner");

            if (miner.lives == 0 || miner.shields == 0) {
                results[i] = false;
                continue;
            }
            
            updateMinerState(miner, _minerIds[i]);
            uint256 rewards = minerLogic.calculateRewards(miner);
            
            if (rewards > 0) {
                storageCore.updateVerditeBalance(msg.sender, rewards, true);
                storageCore.updateMinerLastReward(_minerIds[i], uint64(block.timestamp));
                totalRewards += rewards;
                results[i] = true;
            } else {
                results[i] = false;
            }
        }
        
        return (totalRewards, results);
    }
}