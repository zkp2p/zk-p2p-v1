pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract P2PExchange {
    IERC20 public ethToken;
    uint256 public orderIdCounter;

    struct Order {
        uint256 id;
        address payable marketMaker;
        uint256 ethAmount;
        uint256 exchangeRate; // Exchange rate in units of USD per 1 ETH
        bool isActive;
    }

    mapping(uint256 => Order) public orders;

    event OrderCreated(uint256 indexed orderId, address indexed marketMaker, uint256 ethAmount, uint256 exchangeRate);
    event OrderCancelled(uint256 indexed orderId, address indexed marketMaker);
    event OrderExecuted(uint256 indexed orderId, address indexed marketMaker, address indexed buyer, uint256 takenEthAmount);

    constructor(IERC20 _ethToken) {
        ethToken = _ethToken;
        orderIdCounter = 0;
    }

    function createOrder(uint256 ethAmount, uint256 exchangeRate) external {
        require(ethAmount > 0, "Invalid ETH amount");
        require(exchangeRate > 0, "Invalid exchange rate");

        orderIdCounter++;

        orders[orderIdCounter] = Order({
            id: orderIdCounter,
            marketMaker: payable(msg.sender),
            ethAmount: ethAmount,
            exchangeRate: exchangeRate,
            isActive: true
        });

        ethToken.transferFrom(msg.sender, address(this), ethAmount);

        emit OrderCreated(orderIdCounter, msg.sender, ethAmount, exchangeRate);
    }

    function cancelOrder(uint256 orderId) external {
        Order storage order = orders[orderId];
        require(order.marketMaker == msg.sender, "Not the market maker");
        require(order.isActive, "Order is not active");

        order.isActive = false;
        ethToken.transfer(msg.sender, order.ethAmount);

        emit OrderCancelled(orderId, msg.sender);
    }

    function executeOrder(uint256 orderId, uint256 takenEthAmount) external payable {
        Order storage order = orders[orderId];
        require(order.isActive, "Order is not active");
        require(takenEthAmount > 0 && takenEthAmount <= order.ethAmount, "Invalid taken ETH amount");
        
        uint256 requiredUsdAmount = takenEthAmount * order.exchangeRate;
        // confirm amount sent off-chain > requiredUsdAmount

        order.ethAmount -= takenEthAmount;
        ethToken.transfer(msg.sender, takenEthAmount);

        if (order.ethAmount == 0) {
            order.isActive = false;
        }

        emit OrderExecuted(orderId, order.marketMaker, msg.sender, takenEthAmount);
    }
}
