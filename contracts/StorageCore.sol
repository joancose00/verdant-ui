// SPDX-License-Identifier: MIT
pragma solidity 0.8.29;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/*
 * @author ~ 🅧🅘🅟🅩🅔🅡 ~
 *
 * ██╗░░░██╗███████╗██████╗░██████╗░░█████╗░███╗░░██╗████████╗
 * ██║░░░██║██╔════╝██╔══██╗██╔══██╗██╔══██╗████╗░██║╚══██╔══╝
 * ╚██╗░██╔╝█████╗░░██████╔╝██║░░██║███████║██╔██╗██║░░░██║░░░
 * ░╚████╔╝░██╔══╝░░██╔══██╗██║░░██║██╔══██║██║╚████║░░░██║░░░
 * ░░╚██╔╝░░███████╗██║░░██║██████╔╝██║░░██║██║░╚███║░░░██║░░░
 * ░░░╚═╝░░░╚══════╝╚═╝░░╚═╝╚═════╝░╚═╝░░╚═╝╚═╝░░╚══╝░░░╚═╝░░░
 * Description: The Official Verdant World Storage Contract
 *
 * X: https://x.com/ProjectVerdant
 * Telegram: https://t.me/ProjectVerdant
 * Website: https://projectverdant.com
*/
contract StorageCore is UUPSUpgradeable, OwnableUpgradeable, AccessControlUpgradeable {
    bytes32 public constant LOGIC_ROLE = keccak256("LOGIC_ROLE");
        
    uint256 public bloomRate;
    uint256 public verditeRate;
    uint16 public taxPercentage;
    uint16 public referralPercentage;
    
    address public verdantToken;
    
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
    
    struct GiftMiner {
        address recipient;
        uint8 minerType;
        bool claimed;
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
    
    uint8 public totalMinerTypes;
    uint8 public totalItemTypes;
    uint256 public nextMinerId;
    uint256 public totalMiners;
    uint256 public totalGiftMiners;
    uint256 public nextItemId;
    uint256 public totalItems;
    uint256 public totalGiftItems;
    
    mapping(uint256 => Miner) public miners;
    mapping(uint8 => MinerType) public minerTypes;
    mapping(uint256 => GiftMiner) public giftMiners;
    mapping(uint256 => Item) public items;
    mapping(uint8 => ItemType) public itemTypes;
    mapping(uint256 => GiftItem) public giftItems;
    mapping(address => uint256) public bloomBalances;
    mapping(address => uint256) public verditeBalances;
    mapping(address => address) public referrers;
    mapping(address => uint256) public referralCount;
    mapping(address => uint256[]) public playerMiners;
    mapping(address => uint256[]) public playerGiftMiners;
    mapping(address => uint256[]) public playerItems;
    mapping(address => uint256[]) public playerGiftItems;
    mapping(address => mapping(uint8 => uint8)) public playerMinerCount;
    mapping(address => mapping(uint8 => uint8)) public playerExpansionSlots;
    mapping(address => uint256) public deposits;
    mapping(address => uint256) public withdrawals;
    
    /**
     * @dev Initializes the StorageCore contract with default values
     * @param _verdantToken Address of the Verdant token
     */
    function initialize(address _verdantToken) external initializer {
        __UUPSUpgradeable_init();
        __Ownable_init(msg.sender);
        __AccessControl_init();
        _grantRole(LOGIC_ROLE, msg.sender);
        verdantToken = _verdantToken;
        bloomRate = 1000;
        verditeRate = 5000;
        taxPercentage = 1000;
        referralPercentage = 250;
        nextMinerId = 1;
        nextItemId = 1;
    }
    
    /**
     * @dev Required override for UUPS upgradeable pattern
     * @param newImplementation Address of the new implementation
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    /**
     * @dev Grants the LOGIC_ROLE to an address
     * @param _logic Address to grant the LOGIC_ROLE to
     */
    function grantLogicRole(address _logic) external onlyOwner {
        _grantRole(LOGIC_ROLE, _logic);
    }
    
    /**
     * @dev Revokes the LOGIC_ROLE from an address
     * @param _logic Address to revoke the LOGIC_ROLE from
     */
    function revokeLogicRole(address _logic) external onlyOwner {
        _revokeRole(LOGIC_ROLE, _logic);
    }

    /**
     * @dev Returns all miner IDs owned by a player
     * @param _player Address of the player
     * @return Array of miner IDs owned by the player
     */
    function getAllPlayerMiners(address _player) external view returns (uint256[] memory) {
        return playerMiners[_player];
    }

    /**
     * @dev Returns all gift miner IDs for a player
     * @param _player Address of the player
     * @return Array of gift miner IDs for the player
     */
    function getAllPlayerGiftMiners(address _player) external view returns (uint256[] memory) {
        return playerGiftMiners[_player];
    }

    /**
     * @dev Returns all item IDs owned by a player
     * @param _player Address of the player
     * @return Array of item IDs owned by the player
     */
    function getAllPlayerItems(address _player) external view returns (uint256[] memory) {
        return playerItems[_player];
    }

    /**
     * @dev Returns all gift item IDs for a player
     * @param _player Address of the player
     * @return Array of gift item IDs for the player
     */
    function getAllPlayerGiftItems(address _player) external view returns (uint256[] memory) {
        return playerGiftItems[_player];
    }

    /**
     * @dev Get the current count of active miners a player has of a specific rarity
     * @param _player Address of the player
     * @param _rarity Rarity tier of the miners
     * @return The count of active miners of this rarity
     */
    function getCurrentMinerCount(address _player, uint8 _rarity) public view returns (uint8) {
        return playerMinerCount[_player][_rarity];
    }

    /**
     * @dev Sets the economic parameters of the game
     * @param _bloomRate Conversion rate from Verdant to Bloom
     * @param _verditeRate Conversion rate from Verdant to Verdite
     * @param _taxPercentage Percentage of tax on transactions (basis points)
     * @param _referralPercentage Percentage of referral rewards (basis points)
     */
    function setEconomicParameters(
        uint256 _bloomRate,
        uint256 _verditeRate,
        uint16 _taxPercentage,
        uint16 _referralPercentage
    ) external onlyOwner {
        bloomRate = _bloomRate;
        verditeRate = _verditeRate;
        taxPercentage = _taxPercentage;
        referralPercentage = _referralPercentage;
    }
    
    /**
     * @dev Sets or updates a miner type
     * @param _typeId ID of the miner type
     * @param _rarity Rarity tier of the miner
     * @param _lives Initial lives for the miner
     * @param _initialShields Initial shields for the miner
     * @param _shieldsCapacity Maximum shields capacity for the miner
     */
    function setMinerType(
        uint8 _typeId,
        uint8 _rarity,
        uint8 _lives,
        uint8 _initialShields,
        uint8 _shieldsCapacity
    ) external onlyRole(LOGIC_ROLE) {
        minerTypes[_typeId] = MinerType({
            rarity: _rarity,
            initialLives: _lives,
            initialShields: _initialShields,
            shieldsCapacity: _shieldsCapacity
        });
        if (_typeId >= totalMinerTypes) {
            totalMinerTypes = _typeId + 1;
        }
    }
    
    /**
     * @dev Sets or updates an item type
     * @param _typeId ID of the item type
     * @param _effect Effect type of the item
     * @param _rarity Rarity tier of the item
     * @param _maxQuantity Maximum quantity a player can own
     */
    function setItemType(uint8 _typeId, uint8 _effect, uint8 _rarity, uint8 _maxQuantity) external onlyRole(LOGIC_ROLE) {
        itemTypes[_typeId] = ItemType({ effect: _effect, rarity: _rarity, maxQuantity: _maxQuantity });
        if (_typeId >= totalItemTypes) {
            totalItemTypes = _typeId + 1;
        }
    }
    
    /**
     * @dev Sets the referrer for a player
     * @param _player Address of the player
     * @param _referrer Address of the referrer
     */
    function setReferrer(address _player, address _referrer) external onlyRole(LOGIC_ROLE) {
        referrers[_player] = _referrer;
        referralCount[_referrer]++;
    }

    /**
     * @dev Updates a miner's type
     * @param _minerId ID of the miner
     * @param _minerType New type ID for the miner
     */
    function updateMinerType(uint256 _minerId, uint8 _minerType) external onlyRole(LOGIC_ROLE) {
        miners[_minerId].minerType = _minerType;
    }
    
    /**
     * @dev Updates a miner's lives
     * @param _minerId ID of the miner
     * @param _lives New lives value for the miner
     */
    function updateMinerLives(uint256 _minerId, uint8 _lives) external onlyRole(LOGIC_ROLE) {
        miners[_minerId].lives = _lives;
    }
    
    /**
     * @dev Updates a miner's shields
     * @param _minerId ID of the miner
     * @param _shields New shields value for the miner
     */
    function updateMinerShields(uint256 _minerId, uint8 _shields) external onlyRole(LOGIC_ROLE) {
        miners[_minerId].shields = _shields;
    }
    
    /**
     * @dev Updates a miner's last maintenance timestamp
     * @param _minerId ID of the miner
     * @param _lastMaintenance New last maintenance timestamp
     */
    function updateMinerLastMaintenance(uint256 _minerId, uint64 _lastMaintenance) external onlyRole(LOGIC_ROLE) {
        miners[_minerId].lastMaintenance = _lastMaintenance;
    }
    
    /**
     * @dev Updates a miner's last reward timestamp
     * @param _minerId ID of the miner
     * @param _lastReward New last reward timestamp
     */
    function updateMinerLastReward(uint256 _minerId, uint64 _lastReward) external onlyRole(LOGIC_ROLE) {
        miners[_minerId].lastReward = _lastReward;
    }
    
    /**
     * @dev Updates a miner's grace period end timestamp
     * @param _minerId ID of the miner
     * @param _gracePeriodEnd New grace period end timestamp
     */
    function updateMinerGracePeriod(uint256 _minerId, uint64 _gracePeriodEnd) external onlyRole(LOGIC_ROLE) {
        miners[_minerId].gracePeriodEnd = _gracePeriodEnd;
    }

    /**
     * @dev Updates the number of expansion slots for a player's miners of a specific rarity
     * @param _player Address of the player
     * @param _rarity Rarity tier of the miners
     * @param _expansionSlots Number of expansion slots to set
     */
    function updateTierSlots(address _player, uint8 _rarity, uint8 _expansionSlots) external onlyRole(LOGIC_ROLE) {
        playerExpansionSlots[_player][_rarity] = _expansionSlots;
    }

    /**
     * @dev Updates an item's quantity, removing it if quantity is 0
     * @param _itemId ID of the item
     * @param _quantity New quantity for the item
     */
    function updateItemQuantity(uint256 _itemId, uint16 _quantity) public onlyRole(LOGIC_ROLE) {
        if (_quantity == 0) {
            removeItem(_itemId);
        }
        else {
            items[_itemId].quantity = _quantity;
        }
    }

    /**
     * @dev Updates a player's Bloom balance
     * @param _player Address of the player
     * @param _amount Amount to update
     * @param _increase True to increase balance, false to decrease
     */
    function updateBloomBalance(address _player, uint256 _amount, bool _increase) external onlyRole(LOGIC_ROLE) {
        if (_increase) {
            bloomBalances[_player] += _amount;
        } else {
            require(bloomBalances[_player] >= _amount, "Insufficient balance");
            bloomBalances[_player] -= _amount;
        }
    }

    /**
     * @dev Updates a player's Verdite balance
     * @param _player Address of the player
     * @param _amount Amount to update
     * @param _increase True to increase balance, false to decrease
     */
    function updateVerditeBalance(address _player, uint256 _amount, bool _increase) external onlyRole(LOGIC_ROLE) {
        if (_increase) {
            verditeBalances[_player] += _amount;
        } else {
            require(verditeBalances[_player] >= _amount, "Insufficient balance");
            verditeBalances[_player] -= _amount;
        }
    }
    
    /**
     * @dev Receives Verdant tokens from a player and handles tax
     * @param _player Address of the player depositing tokens
     * @param _amount Total amount of Verdant tokens being deposited
     * @param _tax Amount of tax to be sent to the token contract
     */
    function receiveVerdant(address _player, uint256 _amount, uint256 _tax) external onlyRole(LOGIC_ROLE) {
        require(IERC20(verdantToken).transferFrom(_player, address(this), _amount), "Transfer failed");
        
        if (_tax > 0) {
            require(IERC20(verdantToken).transfer(verdantToken, _tax), "Tax transfer failed");
        }
        
        deposits[_player] += _amount;
    }
    
    /**
     * @dev Sends Verdant tokens to a player and handles tax
     * @param _player Address of the player receiving tokens
     * @param _amount Amount of Verdant tokens being sent to the player
     * @param _tax Amount of tax to be sent to the token contract
     */
    function sendVerdant(address _player, uint256 _amount, uint256 _tax) external onlyRole(LOGIC_ROLE) {        
        uint256 totalAmount = _amount + _tax;
        require(IERC20(verdantToken).balanceOf(address(this)) >= totalAmount, "Insufficient token balance");
        require(IERC20(verdantToken).transfer(_player, _amount), "Transfer failed");
        
        if (_tax > 0) {
            require(IERC20(verdantToken).transfer(verdantToken, _tax), "Tax transfer failed");
        }
        
        withdrawals[_player] += _amount;
    }
    
    /**
     * @dev Creates a new miner for a player
     * @param _owner Address of the player
     * @param _minerType Type ID of the miner to create
     * @return ID of the newly created miner
     */
    function createMiner(address _owner, uint8 _minerType) public onlyRole(LOGIC_ROLE) returns (uint256) {
        MinerType memory mType = minerTypes[_minerType];
        playerMinerCount[_owner][mType.rarity]++;
        uint256 minerId = nextMinerId++;
        totalMiners++;
        miners[minerId] = Miner({
            owner: _owner,
            minerType: _minerType,
            lives: mType.initialLives,
            shields: mType.initialShields,
            lastMaintenance: uint64(block.timestamp),
            lastReward: uint64(block.timestamp),
            gracePeriodEnd: 0
        });
        playerMiners[_owner].push(minerId);
        return minerId;
    }

    /**
     * @dev Creates a new item for a player
     * @param _owner Address of the player
     * @param _itemType Type ID of the item to create
     * @param _quantity Quantity of the item
     * @return ID of the newly created item
     */
    function createItem(address _owner, uint8 _itemType, uint16 _quantity) public onlyRole(LOGIC_ROLE) returns (uint256) {
        uint256 itemId = nextItemId++;
        totalItems++;
        items[itemId] = Item({
            owner: _owner,
            itemType: _itemType,
            quantity: _quantity
        });
        playerItems[_owner].push(itemId);
        return itemId;
    }

    /**
     * @dev Replaces a miner with a new miner of a different rarity
     * @param _owner Address of the player
     * @param _minerType ID of the new miner type
     * @param _minerId ID of the miner to replace
     */
    function replaceMiner(address _owner, uint8 _minerType, uint256 _minerId) public onlyRole(LOGIC_ROLE) {
        MinerType memory newMiner = minerTypes[_minerType];
        miners[_minerId] = Miner({
            owner: _owner,
            minerType: _minerType,
            lives: newMiner.initialLives,
            shields: newMiner.initialShields,
            lastMaintenance: uint64(block.timestamp),
            lastReward: uint64(block.timestamp),
            gracePeriodEnd: 0
        });
    }

    /**
     * @dev Removes an item from a player's inventory
     * @param _itemId ID of the item to remove
     */
    function removeItem(uint256 _itemId) internal {
        address owner = items[_itemId].owner;
        uint256[] storage playerItemsList = playerItems[owner];
        for (uint i = 0; i < playerItemsList.length; i++) {
            if (playerItemsList[i] == _itemId) {
                playerItemsList[i] = playerItemsList[playerItemsList.length - 1];
                playerItemsList.pop();
                break;
            }
        }
        delete items[_itemId];
    }

    /**
     * @dev Removes a gift miner from a player's gift inventory
     * @param _owner Address of the player
     * @param _giftMinerId ID of the gift miner to remove
     */
    function _removeGiftMiner(address _owner, uint256 _giftMinerId) internal {
        uint256[] storage playerGiftMinersList = playerGiftMiners[_owner];
        for (uint i = 0; i < playerGiftMinersList.length; i++) {
            if (playerGiftMinersList[i] == _giftMinerId) {
                playerGiftMinersList[i] = playerGiftMinersList[playerGiftMinersList.length - 1];
                playerGiftMinersList.pop();
                break;
            }
        }
        delete giftMiners[_giftMinerId];
    }

    /**
     * @dev Removes a gift item from a player's gift inventory
     * @param _giftItemId ID of the gift item to remove
     */
    function _removeGiftItem(address _owner, uint256 _giftItemId) internal {
        uint256[] storage playerGiftItemsList = playerGiftItems[_owner];
        for (uint i = 0; i < playerGiftItemsList.length; i++) {
            if (playerGiftItemsList[i] == _giftItemId) {
                playerGiftItemsList[i] = playerGiftItemsList[playerGiftItemsList.length - 1];
                playerGiftItemsList.pop();
                break;
            }
        }
        delete giftItems[_giftItemId];
    }
    
    /**
     * @dev Creates gift miners for the recipients
     * @param _recipients Addresses of the recipients
     * @param _minerTypes Type IDs of the miners to gift
     */
    function createGiftMiners(address[] memory _recipients, uint8[] memory _minerTypes) external onlyOwner {
        for (uint16 i = 0; i < _recipients.length; i++) {
            uint256 giftMinerId = totalGiftMiners++;
            giftMiners[giftMinerId] = GiftMiner({
                recipient: _recipients[i],
                minerType: _minerTypes[i],
                claimed: false
            });
            playerGiftMiners[_recipients[i]].push(giftMinerId);
        }
    }
    
    /**
     * @dev Creates gift items for the recipients
     * @param _recipients Addresses of the recipients
     * @param _itemTypes Type IDs of the items to gift
     * @param _quantities Quantities of the items
     */
    function createGiftItems(address[] memory _recipients, uint8[] memory _itemTypes, uint8[] memory _quantities) external onlyOwner {
        for (uint16 i = 0; i < _recipients.length; i++) {
            uint256 giftItemId = totalGiftItems++;
            giftItems[giftItemId] = GiftItem({
                recipient: _recipients[i],
                itemType: _itemTypes[i],
                quantity: _quantities[i],
                claimed: false
            });
            playerGiftItems[_recipients[i]].push(giftItemId);
        }
    }

    /**
     * @dev Creates a new miner for a player from a gift miner
     * @param _giftMinerId ID of the gift miner to create a miner from
     */
    function createMinerFromGift(uint256 _giftMinerId) external onlyRole(LOGIC_ROLE) returns (uint256) {
        GiftMiner storage giftMiner = giftMiners[_giftMinerId];
        giftMiner.claimed = true;
        uint256 minerId = createMiner(giftMiner.recipient, giftMiner.minerType);
        _removeGiftMiner(giftMiner.recipient, _giftMinerId);
        return minerId;
    }

    /**
     * @dev Creates a new item for a player from a gift item
     * @param _giftItemId ID of the gift item to claim
     */
    function createItemFromGift(uint256 _giftItemId) external onlyRole(LOGIC_ROLE) returns (uint256) {
        GiftItem storage giftItem = giftItems[_giftItemId];
        giftItem.claimed = true;
        uint256 itemId = createItem(giftItem.recipient, giftItem.itemType, giftItem.quantity);
        _removeGiftItem(giftItem.recipient, _giftItemId);
        return itemId;
    }

    /**
     * @dev Replaces a miner for a player from a gift miner
     * @param _giftMinerId ID of the gift miner to replace a miner from
     */
    function replaceMinerFromGift(uint256 _giftMinerId, uint256 _minerId) external onlyRole(LOGIC_ROLE) {
        GiftMiner storage giftMiner = giftMiners[_giftMinerId];
        giftMiner.claimed = true;
        replaceMiner(giftMiner.recipient, giftMiner.minerType, _minerId);
        _removeGiftMiner(giftMiner.recipient, _giftMinerId);
    }

    /**
     * @dev Updates an item for a player from a gift item
     * @param _giftItemId ID of the gift item to update an item from
     * @param _itemId ID of the item to update
     */
    function updateItemFromGift(uint256 _giftItemId, uint256 _itemId) external onlyRole(LOGIC_ROLE) {
        GiftItem storage giftItem = giftItems[_giftItemId];
        giftItem.claimed = true;
        updateItemQuantity(_itemId, giftItem.quantity);
        _removeGiftItem(giftItem.recipient, _giftItemId);
    }

    /**
     * @dev Allows the contract to receive ETH
     */
    receive() external payable {}
}