'use client';

import { useState, useEffect } from 'react';
import Modal from './Modal';
import WalletQueryInterface from './WalletQueryInterface';

export default function WalletQueryModal({ isOpen, onClose, address, chain }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Wallet Query: ${address ? `${address.slice(0, 8)}...${address.slice(-6)}` : ''}`}
    >
      <WalletQueryInterface
        chain={chain}
        prefilledAddress={address}
        isModal={true}
      />
    </Modal>
  );
}