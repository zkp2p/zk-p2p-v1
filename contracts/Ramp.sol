pragma solidity ^0.8.12;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol"; 

import { IVerifier } from "./interfaces/IVerifier.sol";

contract Ramp {
    
    /* ============ Enums ============ */

    enum OrderStatus {
        Unopened,
        Open,
        Filled,
        Canceled
    }

    enum ClaimStatus {
        Unsubmitted,
        Submitted,
        Used,
        Clawback
    }
    
    /* ============ Structs ============ */

    struct Order {
        address onRamper;
        uint256 amountToReceive;
        uint256 maxAmountToPay;
        OrderStatus status;
        address[] claimers;  
    }

    struct OrderClaim {
        uint256 venmoId;
        ClaimStatus status;
        uint256 claimExpirationTime;
    }

    /* ============ Modifiers ============ */

    modifier onlyRegisteredUser() {
        require(userToVenmoId[msg.sender] != 0, "User is not registered");
        _;
    }

    /* ============ Public Variables ============ */

    IVerifier public immutable verifier;
    IERC20 public immutable usdc;
    address public immutable venmoRsaKey;

    uint256 public orderNonce;
    mapping(address=>uint256) public userToVenmoId;
    mapping(uint256=>address) public venmoIdToUser;
    mapping(uint256=>Order) public orders;
    mapping(uint256=>mapping(address=>OrderClaim)) public orderClaims;

    /* ============ External Functions ============ */

    constructor(address _venmoRsaKey, IVerifier _verifier, IERC20 _usdc) {
        venmoRsaKey = _venmoRsaKey;
        verifier = _verifier;
        usdc = _usdc;

        orderNonce = 1;                     // start at 1 so that 0 can be used as a null value
    }

    /* ============ External Functions ============ */

    function register(uint256 _venmoId) external {
        require(userToVenmoId[msg.sender] == 0, "User is already registered");
        userToVenmoId[msg.sender] = _venmoId;
        venmoIdToUser[_venmoId] = msg.sender;
    }

    function postOrder(uint256 _amount, uint256 _maxAmountToPay) external onlyRegisteredUser() {
        require(_amount != 0, "Amount can't be 0");
        require(_maxAmountToPay != 0, "Max amount can't be 0");
        
        Order memory order = Order({
            onRamper: msg.sender,
            amountToReceive: _amount,
            maxAmountToPay: _maxAmountToPay,
            status: OrderStatus.Open,
            claimers: new address[](0)
        });

        orders[orderNonce] = order;
        orderNonce++;
    }

    function claimOrder(
        uint256 _orderNonce
    )
        external 
        onlyRegisteredUser()
    {
        require(orders[orderNonce].status == OrderStatus.Open, "Order has already been filled, canceled, or doesn't exist");
        require(orderClaims[_orderNonce][msg.sender].status == ClaimStatus.Unsubmitted, "Order has already been claimed by caller");
        require(msg.sender != orders[orderNonce].onRamper, "Can't claim your own order");

        orderClaims[_orderNonce][msg.sender] = OrderClaim({
            venmoId: userToVenmoId[msg.sender],
            status: ClaimStatus.Submitted,
            claimExpirationTime: block.timestamp + 1 days
        });
        orders[_orderNonce].claimers.push(msg.sender);

        usdc.transferFrom(msg.sender, address(this), orders[orderNonce].amountToReceive);
    }

    function onRamp(
        uint256 _orderId,
        uint256 _offRamperVenmoId,
        bytes calldata _proof
    )
        external
        onlyRegisteredUser()
    {
        // require it is an open order
        require(orders[_orderId].status == OrderStatus.Open, "Order has already been filled, canceled, or doesn't exist");

        address offRamperAddress = venmoIdToUser[_offRamperVenmoId];
        require(orderClaims[_orderId][offRamperAddress].status == ClaimStatus.Submitted,
            "Claim was never submitted, has been used, or has been clawed back"
        );

        // Validate proof

        orderClaims[_orderId][offRamperAddress].status = ClaimStatus.Used;
        orders[_orderId].status = OrderStatus.Filled;

        usdc.transfer(orders[_orderId].onRamper, orders[orderNonce].amountToReceive);
    }

    function cancelOrder(uint256 _orderId) external {
        require(orders[_orderId].status == OrderStatus.Open, "Order has already been filled, canceled, or doesn't exist");
        require(msg.sender == orders[_orderId].onRamper, "Only the order creator can cancel it");

        orders[_orderId].status = OrderStatus.Canceled;
    }

    function clawback(uint256 _orderId) external {
        // If a claim was never submitted (Unopened), was used to fill order (Used), or was already clawed back (Clawback) then
        // calling address cannot clawback funds
        require(
            orderClaims[_orderId][msg.sender].status == ClaimStatus.Submitted,
            "Msg.sender has not submitted claim, already clawed back claim, or claim was used to fill order"
        );

        // If order is open then mm can only clawback funds if the claim has expired. For the case where order was cancelled all
        // we need to check is that the claim was not already clawed back (which is done above). Similarly, if the order was filled
        // we only need to check that the caller is not the claimer who's order was used to fill the order (also checked above).
        if (orders[_orderId].status == OrderStatus.Open) {
            require(orderClaims[_orderId][msg.sender].claimExpirationTime < block.timestamp, "Order claim has not expired");
        }

        orderClaims[_orderId][msg.sender].status = ClaimStatus.Clawback;
        usdc.transfer(msg.sender, orders[_orderId].amountToReceive);
    }

    /* ============ View Functions ============ */

    function getClaimsForOrder(uint256 _orderId) external view returns (OrderClaim[] memory) {
        address[] memory claimers = orders[_orderId].claimers;

        OrderClaim[] memory orderClaimsArray = new OrderClaim[](claimers.length);
        for (uint256 i = 0; i < claimers.length; i++) {
            orderClaimsArray[i] = orderClaims[_orderId][claimers[i]];
        }

        return orderClaimsArray;
    }
}
