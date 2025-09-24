export const abi = [
  // L2MessageQueue
  'event AppendMessage(uint256 index, bytes32 messageHash)',

  // L2ScrollMessengerValidium
  'event SentMessage(address indexed sender, address indexed target, uint256 value, uint256 messageNonce, uint256 gasLimit, bytes message)',
];
