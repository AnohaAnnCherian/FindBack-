
 // SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FindBack {
    enum ItemStatus {
        Reported,
        Claimed,
        Returned
    }

    struct Item {
        uint256 id;
        address reporter;
        string name;
        string description;
        bool isFound;
        bytes32 claimCodeHash;
        address claimant;
        ItemStatus status;
        uint256 reportedAt;
    }

    uint256 public itemCount;
    mapping(uint256 => Item) private items;

    event ItemReported(
        uint256 indexed itemId,
        address indexed reporter,
        bool isFound
    );

    event ItemClaimed(
        uint256 indexed itemId,
        address indexed claimant
    );

    event ItemReturned(
        uint256 indexed itemId,
        address indexed reporter
    );

    function reportItem(
        string calldata name,
        string calldata description,
        bool isFound,
        bytes32 claimCodeHash
    ) external {
        require(bytes(name).length > 0, "Name required");
        require(bytes(description).length > 0, "Description required");
        require(claimCodeHash != bytes32(0), "Claim hash required");

        itemCount++;

        items[itemCount] = Item({
            id: itemCount,
            reporter: msg.sender,
            name: name,
            description: description,
            isFound: isFound,
            claimCodeHash: claimCodeHash,
            claimant: address(0),
            status: ItemStatus.Reported,
            reportedAt: block.timestamp
        });

        emit ItemReported(itemCount, msg.sender, isFound);
    }

    function claimItem(
        uint256 itemId,
        bytes32 claimCodeHash
    ) external {
        Item storage item = items[itemId];

        require(itemId > 0 && itemId <= itemCount, "Item not found");
        require(item.status == ItemStatus.Reported, "Item not available");
        require(msg.sender != item.reporter, "Reporter cannot claim");
        require(
            item.claimCodeHash == claimCodeHash,
            "Claim verification failed"
        );

        item.claimant = msg.sender;
        item.status = ItemStatus.Claimed;

        emit ItemClaimed(itemId, msg.sender);
    }

    function markReturned(uint256 itemId) external {
        Item storage item = items[itemId];

        require(itemId > 0 && itemId <= itemCount, "Item not found");
        require(msg.sender == item.reporter, "Only reporter can confirm");
        require(item.status == ItemStatus.Claimed, "Item not claimed");

        item.status = ItemStatus.Returned;

        emit ItemReturned(itemId, msg.sender);
    }

    function getItem(
        uint256 itemId
    )
        external
        view
        returns (
            uint256 id,
            address reporter,
            string memory name,
            string memory description,
            bool isFound,
            address claimant,
            ItemStatus status,
            uint256 reportedAt
        )
    {
        require(itemId > 0 && itemId <= itemCount, "Item not found");

        Item storage item = items[itemId];

        return (
            item.id,
            item.reporter,
            item.name,
            item.description,
            item.isFound,
            item.claimant,
            item.status,
            item.reportedAt
        );
    }
}
