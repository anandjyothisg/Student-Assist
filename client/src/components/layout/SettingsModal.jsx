import React from 'react';
import { Modal } from '../ui/Modal';
import { SettingsPanel } from './SettingsPanel';

export function SettingsModal({ isOpen, onClose, user, onLogout, onUpdateUser }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Settings" size="xl" className="md:h-[min(620px,86dvh)]">
      <SettingsPanel user={user} onLogout={onLogout} onUpdateUser={onUpdateUser} />
    </Modal>
  );
}
