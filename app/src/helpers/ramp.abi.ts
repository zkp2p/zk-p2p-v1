export const abi = [
   {
     "inputs": [
       {
         "internalType": "uint256[17]",
         "name": "_venmoMailserverKeys",
         "type": "uint256[17]"
       },
       {
         "internalType": "contract IERC20",
         "name": "_usdc",
         "type": "address"
       }
     ],
     "stateMutability": "nonpayable",
     "type": "constructor"
   },
   {
     "inputs": [
       {
         "internalType": "uint256",
         "name": "_orderId",
         "type": "uint256"
       }
     ],
     "name": "cancelOrder",
     "outputs": [],
     "stateMutability": "nonpayable",
     "type": "function"
   },
   {
     "inputs": [
       {
         "internalType": "uint256",
         "name": "_orderNonce",
         "type": "uint256"
       }
     ],
     "name": "claimOrder",
     "outputs": [],
     "stateMutability": "nonpayable",
     "type": "function"
   },
   {
     "inputs": [
       {
         "internalType": "uint256",
         "name": "_orderId",
         "type": "uint256"
       }
     ],
     "name": "clawback",
     "outputs": [],
     "stateMutability": "nonpayable",
     "type": "function"
   },
   {
     "inputs": [],
     "name": "getAllOrders",
     "outputs": [
       {
         "components": [
           {
             "internalType": "uint256",
             "name": "id",
             "type": "uint256"
           },
           {
             "internalType": "address",
             "name": "onRamper",
             "type": "address"
           },
           {
             "internalType": "uint256",
             "name": "amountToReceive",
             "type": "uint256"
           },
           {
             "internalType": "uint256",
             "name": "maxAmountToPay",
             "type": "uint256"
           },
           {
             "internalType": "enum Ramp.OrderStatus",
             "name": "status",
             "type": "uint8"
           },
           {
             "internalType": "address[]",
             "name": "claimers",
             "type": "address[]"
           }
         ],
         "internalType": "struct Ramp.OrderWithId[]",
         "name": "",
         "type": "tuple[]"
       }
     ],
     "stateMutability": "view",
     "type": "function"
   },
   {
     "inputs": [
       {
         "internalType": "uint256",
         "name": "_orderId",
         "type": "uint256"
       }
     ],
     "name": "getClaimsForOrder",
     "outputs": [
       {
         "components": [
           {
             "internalType": "uint256",
             "name": "venmoId",
             "type": "uint256"
           },
           {
             "internalType": "enum Ramp.ClaimStatus",
             "name": "status",
             "type": "uint8"
           },
           {
             "internalType": "uint256",
             "name": "claimExpirationTime",
             "type": "uint256"
           }
         ],
         "internalType": "struct Ramp.OrderClaim[]",
         "name": "",
         "type": "tuple[]"
       }
     ],
     "stateMutability": "view",
     "type": "function"
   },
   {
     "inputs": [],
     "name": "msgLen",
     "outputs": [
       {
         "internalType": "uint16",
         "name": "",
         "type": "uint16"
       }
     ],
     "stateMutability": "view",
     "type": "function"
   },
   {
     "inputs": [
       {
         "internalType": "uint256",
         "name": "_orderId",
         "type": "uint256"
       },
       {
         "internalType": "uint256",
         "name": "_offRamperVenmoId",
         "type": "uint256"
       },
       {
         "internalType": "uint256[2]",
         "name": "_a",
         "type": "uint256[2]"
       },
       {
         "internalType": "uint256[2][2]",
         "name": "_b",
         "type": "uint256[2][2]"
       },
       {
         "internalType": "uint256[2]",
         "name": "_c",
         "type": "uint256[2]"
       },
       {
         "internalType": "uint256[27]",
         "name": "_signals",
         "type": "uint256[27]"
       }
     ],
     "name": "onRamp",
     "outputs": [],
     "stateMutability": "nonpayable",
     "type": "function"
   },
   {
     "inputs": [
       {
         "internalType": "uint256",
         "name": "",
         "type": "uint256"
       },
       {
         "internalType": "address",
         "name": "",
         "type": "address"
       }
     ],
     "name": "orderClaims",
     "outputs": [
       {
         "internalType": "uint256",
         "name": "venmoId",
         "type": "uint256"
       },
       {
         "internalType": "enum Ramp.ClaimStatus",
         "name": "status",
         "type": "uint8"
       },
       {
         "internalType": "uint256",
         "name": "claimExpirationTime",
         "type": "uint256"
       }
     ],
     "stateMutability": "view",
     "type": "function"
   },
   {
     "inputs": [],
     "name": "orderNonce",
     "outputs": [
       {
         "internalType": "uint256",
         "name": "",
         "type": "uint256"
       }
     ],
     "stateMutability": "view",
     "type": "function"
   },
   {
     "inputs": [
       {
         "internalType": "uint256",
         "name": "",
         "type": "uint256"
       }
     ],
     "name": "orders",
     "outputs": [
       {
         "internalType": "address",
         "name": "onRamper",
         "type": "address"
       },
       {
         "internalType": "uint256",
         "name": "amountToReceive",
         "type": "uint256"
       },
       {
         "internalType": "uint256",
         "name": "maxAmountToPay",
         "type": "uint256"
       },
       {
         "internalType": "enum Ramp.OrderStatus",
         "name": "status",
         "type": "uint8"
       }
     ],
     "stateMutability": "view",
     "type": "function"
   },
   {
     "inputs": [
       {
         "internalType": "uint256",
         "name": "_amount",
         "type": "uint256"
       },
       {
         "internalType": "uint256",
         "name": "_maxAmountToPay",
         "type": "uint256"
       }
     ],
     "name": "postOrder",
     "outputs": [],
     "stateMutability": "nonpayable",
     "type": "function"
   },
   {
     "inputs": [
       {
         "internalType": "uint256",
         "name": "_venmoId",
         "type": "uint256"
       }
     ],
     "name": "register",
     "outputs": [],
     "stateMutability": "nonpayable",
     "type": "function"
   },
   {
     "inputs": [],
     "name": "rsaModulusChunksLen",
     "outputs": [
       {
         "internalType": "uint256",
         "name": "",
         "type": "uint256"
       }
     ],
     "stateMutability": "view",
     "type": "function"
   },
   {
     "inputs": [],
     "name": "usdc",
     "outputs": [
       {
         "internalType": "contract IERC20",
         "name": "",
         "type": "address"
       }
     ],
     "stateMutability": "view",
     "type": "function"
   },
   {
     "inputs": [
       {
         "internalType": "address",
         "name": "",
         "type": "address"
       }
     ],
     "name": "userToVenmoId",
     "outputs": [
       {
         "internalType": "uint256",
         "name": "",
         "type": "uint256"
       }
     ],
     "stateMutability": "view",
     "type": "function"
   },
   {
     "inputs": [
       {
         "internalType": "uint256",
         "name": "",
         "type": "uint256"
       }
     ],
     "name": "venmoIdToUser",
     "outputs": [
       {
         "internalType": "address",
         "name": "",
         "type": "address"
       }
     ],
     "stateMutability": "view",
     "type": "function"
   },
   {
     "inputs": [
       {
         "internalType": "uint256",
         "name": "",
         "type": "uint256"
       }
     ],
     "name": "venmoMailserverKeys",
     "outputs": [
       {
         "internalType": "uint256",
         "name": "",
         "type": "uint256"
       }
     ],
     "stateMutability": "view",
     "type": "function"
   },
   {
     "inputs": [
       {
         "internalType": "uint256[2]",
         "name": "a",
         "type": "uint256[2]"
       },
       {
         "internalType": "uint256[2][2]",
         "name": "b",
         "type": "uint256[2][2]"
       },
       {
         "internalType": "uint256[2]",
         "name": "c",
         "type": "uint256[2]"
       },
       {
         "internalType": "uint256[27]",
         "name": "input",
         "type": "uint256[27]"
       }
     ],
     "name": "verifyProof",
     "outputs": [
       {
         "internalType": "bool",
         "name": "r",
         "type": "bool"
       }
     ],
     "stateMutability": "view",
     "type": "function"
   }
 ];
 