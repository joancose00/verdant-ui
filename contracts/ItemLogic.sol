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
    struct MinerType {
        uint8 rarity;
        uint8 initialLives;
        uint8 initialShields;
        uint8 shieldsCapacity;
    }
    struct ItemType {
        uint8 effect;
        uint8 rarity;
        uint8 maxQuantity;
    }
    struct Item {
        address owner;
        uint8 itemType;
        uint16 quantity;
    }
    struct GiftItem {
        address recipient;
        uint8 itemType;
        uint16 quantity;
        bool claimed;
    }

    function bloomRate() external view returns (uint256);
    function verditeRate() external view returns (uint256);
    function totalItemTypes() external view returns (uint8);
    function miners(uint256 _minerId) external view returns (Miner memory);
    function minerTypes(uint8 _typeId) external view returns (MinerType memory);
    function items(uint256 _itemId) external view returns (Item memory);
    function itemTypes(uint8 _typeId) external view returns (ItemType memory);
    function giftItems(uint256 _giftItemId) external view returns (GiftItem memory);
    function playerExpansionSlots(address _player, uint8 _rarity) external view returns (uint8);
    function getAllPlayerItems(address _player) external view returns (uint256[] memory);
    function getAllPlayerGiftItems(address _player) external view returns (uint256[] memory);
    function setItemType(uint8 _typeId, uint8 _effect, uint8 _rarity, uint8 _maxQuantity) external;
    function updateMinerLives(uint256 _minerId, uint8 _lives) external;
    function updateMinerShields(uint256 _minerId, uint8 _shields) external;
    function updateMinerGracePeriod(uint256 _minerId, uint64 _gracePeriodEnd) external;
    function updateTierSlots(address _player, uint8 _rarity, uint8 _expansionSlots) external;
    function updateItemQuantity(uint256 _itemId, uint16 _quantity) external;
    function updateBloomBalance(address _player, uint256 _amount, bool _isAddition) external;
    function createItem(address _owner, uint8 _itemType, uint16 _quantity) external returns (uint256);
    function deposits(address _player) external view returns (uint256);
    function withdrawals(address _player) external view returns (uint256);
    function replaceMiner(address _owner, uint8 _minerType, uint256 _minerId) external;
    function createItemFromGift(uint256 _giftItemId) external returns (uint256);
    function updateItemFromGift(uint256 _giftItemId, uint256 _itemId) external;
}

interface IMinerLogic {
    function calculateMinerBloomCost(uint8 _minerType) external view returns (uint256);
    function calculateRewardsRate(uint8 _minerType, uint256 _bloomCost) external view returns (uint256);
    function calculateMinerLives(IStorageCore.Miner memory miner) external view returns (uint8);
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
 * Description: The Official Verdant World Item Logic Contract
 *
 * X: https://x.com/ProjectVerdant
 * Telegram: https://t.me/ProjectVerdant
 * Website: https://projectverdant.com
*/
contract ItemLogic is Ownable {
    IStorageCore public storageCore;
    IMinerLogic public minerLogic;

    uint32 public constant GRACE_PERIOD = 24 hours;
    
    uint8 public constant PROMOTIONAL = 0;
    uint8 public constant COMMON = 1;
    uint8 public constant RARE = 2;
    uint8 public constant MYTHIC = 3;
    
    uint8 public constant BASIC_MINER = 1;
    uint8 public constant ADVANCED_MINER = 2;
    uint8 public constant ELITE_MINER = 3;

    uint8 public constant EXPANSION_SLOT = 0;
    uint8 public constant MINOR_BOMB = 1;
    uint8 public constant MAJOR_BOMB = 2;
    uint8 public constant MINOR_SHIELD = 3;
    uint8 public constant MAJOR_SHIELD = 4;
    uint8 public constant RESTORE = 5;
    uint8 public constant REVIVE = 6;
    uint8 public constant MORPH = 7;

    uint8 public constant DEFAULT_ITEM_MAX_QUANTITY = 99;
    uint8 public constant MORPH_MAX_QUANTITY = 1;

    uint8 public constant PROMOTIONAL_DEFAULT_CAPACITY = 3;
    uint8 public constant COMMON_DEFAULT_CAPACITY = 5;
    uint8 public constant RARE_DEFAULT_CAPACITY = 3;
    uint8 public constant MYTHIC_DEFAULT_CAPACITY = 1;
    
    uint8 public constant PROMOTIONAL_MAX_CAPACITY = 3;
    uint8 public constant COMMON_MAX_CAPACITY = 20;
    uint8 public constant RARE_MAX_CAPACITY = 15;
    uint8 public constant MYTHIC_MAX_CAPACITY = 10;
    
    event MinerDisabled(address indexed player, uint256 indexed minerId);

    /**
     * @dev Initializes the ItemLogic contract and sets up default item types
     * @param _storageCore Address of the StorageCore contract
     * @param _minerLogic Address of the MinerLogic contract
     */
    constructor(address _storageCore, address _minerLogic) Ownable(msg.sender) {
        storageCore = IStorageCore(_storageCore);
        minerLogic = IMinerLogic(_minerLogic);
    }
    
    /**
     * @dev Sets up all the default item types across Promotional, Common, Rare and Mythic rarities
     */
    function setupDefaultItemTypes() external onlyOwner {
        storageCore.setItemType(0, EXPANSION_SLOT, COMMON, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(1, EXPANSION_SLOT, RARE, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(2, EXPANSION_SLOT, MYTHIC, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(3, MINOR_BOMB, PROMOTIONAL, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(4, MINOR_BOMB, COMMON, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(5, MINOR_BOMB, RARE, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(6, MINOR_BOMB, MYTHIC, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(7, MAJOR_BOMB, PROMOTIONAL, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(8, MAJOR_BOMB, COMMON, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(9, MAJOR_BOMB, RARE, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(10, MAJOR_BOMB, MYTHIC, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(11, MINOR_SHIELD, PROMOTIONAL, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(12, MINOR_SHIELD, COMMON, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(13, MINOR_SHIELD, RARE, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(14, MINOR_SHIELD, MYTHIC, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(15, MAJOR_SHIELD, PROMOTIONAL, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(16, MAJOR_SHIELD, COMMON, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(17, MAJOR_SHIELD, RARE, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(18, MAJOR_SHIELD, MYTHIC, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(19, RESTORE, COMMON, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(20, RESTORE, RARE, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(21, RESTORE, MYTHIC, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(22, REVIVE, PROMOTIONAL, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(23, REVIVE, COMMON, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(24, REVIVE, RARE, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(25, REVIVE, MYTHIC, DEFAULT_ITEM_MAX_QUANTITY);
        storageCore.setItemType(26, MORPH, COMMON, MORPH_MAX_QUANTITY);
        storageCore.setItemType(27, MORPH, RARE, MORPH_MAX_QUANTITY);
        storageCore.setItemType(28, MORPH, MYTHIC, MORPH_MAX_QUANTITY);
    }

    /**
     * @dev Retrieves all purchasable items from the market
     * @return itemIds Array of item type IDs
     * @return effects Array of item effects
     * @return rarities Array of item rarities
     * @return prices Array of item prices in Bloom
     * @return maxQuantities Array of maximum quantities per item
     */
    function getMarketItems() external view returns (
        uint8[] memory itemIds,
        uint8[] memory effects,
        uint8[] memory rarities,
        uint256[] memory prices,
        uint8[] memory maxQuantities
    ) {
        uint8 totalItemTypes = storageCore.totalItemTypes();
        
        uint8 purchasableCount = 0;
        for (uint8 i = 0; i < totalItemTypes; i++) {
            IStorageCore.ItemType memory itemType = storageCore.itemTypes(i);
            if (itemType.effect != MORPH) {
                purchasableCount++;
            }
        }
        
        itemIds = new uint8[](purchasableCount);
        effects = new uint8[](purchasableCount);
        rarities = new uint8[](purchasableCount);
        prices = new uint256[](purchasableCount);
        maxQuantities = new uint8[](purchasableCount);
        
        uint8 index = 0;
        for (uint8 i = 0; i < totalItemTypes; i++) {
            IStorageCore.ItemType memory itemType = storageCore.itemTypes(i);
            
            if (itemType.effect != MORPH) {
                itemIds[index] = i;
                effects[index] = itemType.effect;
                rarities[index] = itemType.rarity;
                prices[index] = calculateItemCost(itemType.effect, itemType.rarity);
                maxQuantities[index] = itemType.maxQuantity;
                index++;
            }
        }
        
        return (itemIds, effects, rarities, prices, maxQuantities);
    }
    
    /**
     * @dev Retrieves all items in a player's inventory
     * @return itemIds Array of item IDs
     * @return itemTypeIds Array of item type IDs
     * @return effects Array of item effects
     * @return rarities Array of item rarities
     * @return quantities Array of item quantities
     */
    function getPlayerItems(address _player) external view returns (
        uint256[] memory itemIds,
        uint8[] memory itemTypeIds,
        uint8[] memory effects,
        uint8[] memory rarities,
        uint16[] memory quantities
    ) {
        itemIds = storageCore.getAllPlayerItems(_player);
        uint256 itemCount = itemIds.length;

        itemTypeIds = new uint8[](itemCount);
        effects = new uint8[](itemCount);
        rarities = new uint8[](itemCount);
        quantities = new uint16[](itemCount);
        
        for (uint256 i = 0; i < itemCount; i++) {
            IStorageCore.Item memory item = storageCore.items(itemIds[i]);
            IStorageCore.ItemType memory itemType = storageCore.itemTypes(item.itemType);
            
            itemTypeIds[i] = item.itemType;
            effects[i] = itemType.effect;
            rarities[i] = itemType.rarity;
            quantities[i] = item.quantity;
        }
        
        return (itemIds, itemTypeIds, effects, rarities, quantities);
    }
    
    /**
     * @dev Retrieves all unclaimed items in a player's gift inventory
     * @param _player Address of the player
     * @return giftItemIds Array of unclaimed gift item IDs
     * @return itemTypeIds Array of item type IDs
     * @return effects Array of item effects
     * @return rarities Array of item rarities
     * @return quantities Array of item quantities
     */
    function getPlayerGiftItems(address _player) external view returns (
        uint256[] memory giftItemIds,
        uint8[] memory itemTypeIds,
        uint8[] memory effects,
        uint8[] memory rarities,
        uint16[] memory quantities
    ) {
        giftItemIds = storageCore.getAllPlayerGiftItems(_player);
        uint256 giftItemCount = giftItemIds.length;

        itemTypeIds = new uint8[](giftItemCount);
        effects = new uint8[](giftItemCount);
        rarities = new uint8[](giftItemCount);
        quantities = new uint16[](giftItemCount);
        
        for (uint256 i = 0; i < giftItemCount; i++) {
            IStorageCore.GiftItem memory giftItem = storageCore.giftItems(giftItemIds[i]);
            IStorageCore.ItemType memory itemType = storageCore.itemTypes(giftItem.itemType);
            
            itemTypeIds[i] = giftItem.itemType;
            effects[i] = itemType.effect;
            rarities[i] = itemType.rarity;
            quantities[i] = giftItem.quantity;
        }
        
        return (giftItemIds, itemTypeIds, effects, rarities, quantities);
    }

    /**
     * @dev Calculates the item cost based on its effect and rarity
     * @param _effect The effect type of the item
     * @param _rarity The rarity of the item
     * @return The cost of the item in Bloom
     */
    function calculateItemCost(uint8 _effect, uint8 _rarity) internal view returns (uint256) {
        uint256 minerCost = minerLogic.calculateMinerBloomCost(_rarity);
        uint256 dailyRewards = minerLogic.calculateRewardsRate(_rarity, minerCost) / (storageCore.verditeRate() / storageCore.bloomRate());
        
        uint256 withdrawalDepositRatio = 10;
        uint256 userDeposits = storageCore.deposits(msg.sender);
        uint256 userWithdrawals = storageCore.withdrawals(msg.sender);
        
        if (userDeposits > 0) {
            withdrawalDepositRatio = 1 + (userWithdrawals / userDeposits);
        }
        
        if (_effect == EXPANSION_SLOT) {
            return minerCost * 5 / 100;
        } else if (_effect == MINOR_BOMB) {
            return minerCost * 1 / 100;
        } else if (_effect == MAJOR_BOMB) {
            return minerCost * 2 / 100;
        } else if (_effect == MINOR_SHIELD) {
            return dailyRewards * 10 / 100 * withdrawalDepositRatio;
        } else if (_effect == MAJOR_SHIELD) {
            return dailyRewards * 20 / 100 * withdrawalDepositRatio;
        } else if (_effect == RESTORE) {
            return minerCost * 40 / 100;
        } else if (_effect == REVIVE) {
            uint256 baseReviveCost = minerCost * 15 / 100 * withdrawalDepositRatio;
            uint256 maxReviveCost = minerCost * 70 / 100;
            return baseReviveCost > maxReviveCost ? maxReviveCost : baseReviveCost;
        } else if (_effect == MORPH) {
            revert("Morph items cannot be purchased");
        }
        
        revert("Invalid item effect");
    }

    /**
     * @dev Finds an available item slot for a player
     * @param _player The address of the player
     * @param _itemType The type ID of the item to find a slot for
     * @return The index of the first available slot or the length of the player's items array if no available slots are found
     */
    function findItemSlot(address _player, uint8 _itemType) internal view returns (uint256) {
        uint256[] memory playerItems = storageCore.getAllPlayerItems(_player);
        for (uint256 i = 0; i < playerItems.length; i++) {
            if (playerItems[i] == _itemType) {
                return i;
            }
        }
        return playerItems.length;
    }

    function validateItemUsage(uint256 _itemId) internal view returns (IStorageCore.Item memory item) {
        item = storageCore.items(_itemId);
        require(item.owner == msg.sender, "Not the item owner");
        require(item.quantity > 0, "Item has no remaining quantity");
        return item;
    }

    /**
     * @dev Purchases an item with the specified type and quantity
     * @param _itemType The type ID of the item to purchase
     * @param _quantity The quantity of items to purchase
     */
    function purchaseItem(uint8 _itemType, uint16 _quantity) external returns (uint256) {
        require(_itemType < storageCore.totalItemTypes(), "Invalid item type");
        IStorageCore.ItemType memory itemType = storageCore.itemTypes(_itemType);
        require(_quantity <= itemType.maxQuantity, "Max purchase quantity exceeded");
        uint256 itemCost = calculateItemCost(itemType.effect, itemType.rarity) * _quantity;
        uint256 itemSlot = findItemSlot(msg.sender, _itemType);
        if (itemSlot < storageCore.getAllPlayerItems(msg.sender).length) {
            uint16 newQuantity = storageCore.items(itemSlot).quantity + _quantity;
            require(newQuantity <= itemType.maxQuantity, "Max item quantity exceeded");
            storageCore.updateBloomBalance(msg.sender, itemCost, false);
            storageCore.updateItemQuantity(itemSlot, newQuantity);
            return itemSlot;
        }
        storageCore.updateBloomBalance(msg.sender, itemCost, false);
        return storageCore.createItem(msg.sender, _itemType, _quantity);
    }

    /**
     * @dev Uses an expansion slot item to increase miner capacity
     * @param _itemId ID of the expansion slot item to use
     */
    function useExpansionSlot(uint256 _itemId) external {
        IStorageCore.Item memory item = validateItemUsage(_itemId);
        IStorageCore.ItemType memory itemType = storageCore.itemTypes(item.itemType);
        require(itemType.effect == EXPANSION_SLOT, "Item must be an ExpansionSlot");

        uint8 currentExpansions = storageCore.playerExpansionSlots(msg.sender, itemType.rarity);

        uint8 maxExpansions;
        if (itemType.rarity == PROMOTIONAL) {   
            maxExpansions = PROMOTIONAL_MAX_CAPACITY - PROMOTIONAL_DEFAULT_CAPACITY;
        } else if (itemType.rarity == COMMON) {
            maxExpansions = COMMON_MAX_CAPACITY - COMMON_DEFAULT_CAPACITY;
        } else if (itemType.rarity == RARE) {
            maxExpansions = RARE_MAX_CAPACITY - RARE_DEFAULT_CAPACITY;
        } else if (itemType.rarity == MYTHIC) {
            maxExpansions = MYTHIC_MAX_CAPACITY - MYTHIC_DEFAULT_CAPACITY;
        } else {
            revert("Invalid rarity");
        }

        require(currentExpansions < maxExpansions, "Max expansions reached");
        storageCore.updateTierSlots(msg.sender, itemType.rarity, currentExpansions + 1);
        storageCore.updateItemQuantity(_itemId, item.quantity - 1);
    }

    /**
     * @dev Uses a bomb item to reduce shields of a miner
     * @param _itemId ID of the bomb item to use
     * @param _minerId ID of the target miner
     */
    function useBomb(uint256 _itemId, uint256 _minerId) external {
        IStorageCore.Item memory item = validateItemUsage(_itemId);
        IStorageCore.ItemType memory itemType = storageCore.itemTypes(item.itemType);

        uint8 effect = itemType.effect;
        require(effect == MINOR_BOMB || effect == MAJOR_BOMB, "Item must be a Bomb");

        IStorageCore.Miner memory miner = storageCore.miners(_minerId);
        require(miner.owner != msg.sender, "Probably shouldn't be using bombs on yourself");
        uint8 lives = minerLogic.calculateMinerLives(miner);
        require(lives > 0, "Miner is destroyed");
        require(miner.shields > 0, "Miner is disabled");
        require(block.timestamp >= miner.gracePeriodEnd, "Miner is in grace period");
        IStorageCore.MinerType memory minerType = storageCore.minerTypes(miner.minerType);
        require(minerType.rarity == itemType.rarity, "Item and miner rarities don't match");
        
        uint8 shieldReduction = effect == MINOR_BOMB ? 1 : 2;
        uint8 newShields = miner.shields >= shieldReduction ? miner.shields - shieldReduction : 0;
        
        storageCore.updateMinerShields(_minerId, newShields);
        
        if (newShields > 0) {
            storageCore.updateMinerGracePeriod(_minerId, uint64(block.timestamp + GRACE_PERIOD));
        } else {
            emit MinerDisabled(msg.sender, _minerId);
        }

        storageCore.updateItemQuantity(_itemId, item.quantity - 1);
    }

    /**
     * @dev Uses a shield item to increase shields of a miner
     * @param _itemId ID of the shield item to use
     * @param _minerId ID of the target miner
     */
    function useShield(uint256 _itemId, uint256 _minerId) external {
        IStorageCore.Item memory item = validateItemUsage(_itemId);
        IStorageCore.ItemType memory itemType = storageCore.itemTypes(item.itemType);

        uint8 effect = itemType.effect;
        require(effect == MINOR_SHIELD || effect == MAJOR_SHIELD, "Item must be a Shield");
        
        IStorageCore.Miner memory miner = storageCore.miners(_minerId);
        require(miner.owner == msg.sender, "Not the miner owner");
        uint8 lives = minerLogic.calculateMinerLives(miner);
        require(lives > 0, "Miner is destroyed");
        require(miner.shields > 0, "Miner is disabled");
        IStorageCore.MinerType memory minerType = storageCore.minerTypes(miner.minerType);
        require(minerType.rarity == itemType.rarity, "Item and miner rarities don't match");
        require(miner.shields < minerType.shieldsCapacity, "Miner already has max shields");
        
        uint8 shieldAddition = effect == MINOR_SHIELD ? 1 : 2;
        uint8 newShields = miner.shields + shieldAddition > minerType.shieldsCapacity ? minerType.shieldsCapacity : miner.shields + shieldAddition;
        
        storageCore.updateMinerShields(_minerId, newShields);
        storageCore.updateItemQuantity(_itemId, item.quantity - 1);
    }

    /**
     * @dev Uses a restore item to add a life to a miner
     * @param _itemId ID of the restore item to use
     * @param _minerId ID of the target miner
     */
    function useRestore(uint256 _itemId, uint256 _minerId) external {
        IStorageCore.Item memory item = validateItemUsage(_itemId);
        IStorageCore.ItemType memory itemType = storageCore.itemTypes(item.itemType);

        uint8 effect = itemType.effect;
        require(effect == RESTORE, "Item must be a Restore");

        IStorageCore.Miner memory miner = storageCore.miners(_minerId);
        require(miner.owner == msg.sender, "Not the miner owner");
        uint8 lives = minerLogic.calculateMinerLives(miner);
        require(lives > 0, "Miner is destroyed");
        require(miner.shields > 0, "Miner is disabled");
        require(lives < 2, "Lives already at maximum");
        IStorageCore.MinerType memory minerType = storageCore.minerTypes(miner.minerType);
        require(minerType.rarity == itemType.rarity, "Item and miner rarities don't match");
        
        storageCore.updateMinerLives(_minerId, 2);
        storageCore.updateItemQuantity(_itemId, item.quantity - 1);
    }

    /**
     * @dev Uses a revive item to restore shields to a disabled miner
     * @param _itemId ID of the revive item to use
     * @param _minerId ID of the target miner
     */
    function useRevive(uint256 _itemId, uint256 _minerId) external {
        IStorageCore.Item memory item = validateItemUsage(_itemId);
        IStorageCore.ItemType memory itemType = storageCore.itemTypes(item.itemType);

        uint8 effect = itemType.effect;
        require(effect == REVIVE, "Item must be a Revive");
        
        IStorageCore.Miner memory miner = storageCore.miners(_minerId);
        require(miner.owner == msg.sender, "Not the miner owner");
        uint8 lives = minerLogic.calculateMinerLives(miner);
        require(lives > 0, "Miner is destroyed");
        require(miner.shields == 0, "Miner is not disabled");
        IStorageCore.MinerType memory minerType = storageCore.minerTypes(miner.minerType);
        require(minerType.rarity == itemType.rarity, "Item and miner rarities don't match");
        
        storageCore.updateMinerShields(_minerId, minerType.initialShields);
        storageCore.updateMinerGracePeriod(_minerId, uint64(block.timestamp + GRACE_PERIOD));
        storageCore.updateItemQuantity(_itemId, item.quantity - 1);
    }

    /**
     * @dev Uses a morph item to upgrade a miner to the next rarity tier
     * @param _itemId ID of the morph item to use
     * @param _minerId ID of the target miner
     */
    function useMorph(uint256 _itemId, uint256 _minerId) external {
        IStorageCore.Item memory item = validateItemUsage(_itemId);
        IStorageCore.ItemType memory itemType = storageCore.itemTypes(item.itemType);

        uint8 effect = itemType.effect;
        require(effect == MORPH, "Item must be a Morph");
        
        IStorageCore.Miner memory miner = storageCore.miners(_minerId);
        require(miner.owner == msg.sender, "Not the miner owner");
        uint8 lives = minerLogic.calculateMinerLives(miner);
        require(lives > 0, "Miner is destroyed");
        require(miner.shields > 0, "Miner is disabled");
        
        IStorageCore.MinerType memory minerType = storageCore.minerTypes(miner.minerType);
        require(minerType.rarity == itemType.rarity - 1, "Morph can only be used on miners one tier below");
        
        uint8 newMinerType;
        if (minerType.rarity == PROMOTIONAL) {
            newMinerType = BASIC_MINER;
        } else if (minerType.rarity == COMMON) {
            newMinerType = ADVANCED_MINER;
        } else if (minerType.rarity == RARE) {
            newMinerType = ELITE_MINER;
        } else {
            revert("Cannot morph this miner");
        }

        storageCore.replaceMiner(msg.sender, newMinerType, _minerId);
        storageCore.updateItemQuantity(_itemId, item.quantity - 1);
    }

    /**
     * @dev Claims a gifted item and adds it to the player's inventory
     * @param _giftItemId ID of the gift item to claim
     * @return ID of the newly created item
     */
    function claimGiftItem(uint256 _giftItemId) external returns (uint256) {
        IStorageCore.GiftItem memory giftItem = storageCore.giftItems(_giftItemId);
        require(giftItem.recipient == msg.sender, "Not the gift recipient");
        require(giftItem.claimed == false, "Gift item already claimed");
        uint256 itemSlot = findItemSlot(msg.sender, giftItem.itemType);
        if (itemSlot < storageCore.getAllPlayerItems(msg.sender).length) {
            uint16 newQuantity = storageCore.items(itemSlot).quantity + giftItem.quantity;
            require(newQuantity <= storageCore.itemTypes(giftItem.itemType).maxQuantity, "Max item quantity exceeded");
            storageCore.updateItemFromGift(_giftItemId, itemSlot);
            return itemSlot;
        }
        return storageCore.createItemFromGift(_giftItemId);
    }

    /**
     * @dev Retrieves the deposit and withdrawal amounts for an address and calculates the ratio
     * @param _address The address to query
     * @return deposits The deposit amount for the address
     * @return withdrawals The withdrawal amount for the address
     * @return ratio The calculated ratio as 1 + (withdrawals / deposits)
     */
    function getAddressMetrics(address _address) external view returns (
        uint256 deposits,
        uint256 withdrawals,
        uint256 ratio
    ) {
        deposits = storageCore.deposits(_address);
        withdrawals = storageCore.withdrawals(_address);
        
        if (deposits > 0) {
            ratio = 1 + (withdrawals / deposits);
        } else {
            ratio = 10;
        }
        
        return (deposits, withdrawals, ratio);
    }
}