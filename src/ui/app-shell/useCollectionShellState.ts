import { useState } from 'react';

export function useCollectionShellState() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [collaboratorSwitchOpen, setCollaboratorSwitchOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [infoFullscreenOpen, setInfoFullscreenOpen] = useState(false);

  return {
    searchOpen,
    setSearchOpen,
    collaboratorSwitchOpen,
    setCollaboratorSwitchOpen,
    detailOpen,
    setDetailOpen,
    infoFullscreenOpen,
    setInfoFullscreenOpen
  };
}
