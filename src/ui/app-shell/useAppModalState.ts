import { useState } from 'react';
import type { MenuOverlayProps } from '../../app/shell/appShellContracts';
import {
  EMPTY_PROVIDER_BATCH_CONNECTION_TEST_STATE,
  type ProviderBatchConnectionTestState
} from '../../app/shell/providerBatchConnectionTest';

export function useAppModalState() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuInitialPage, setMenuInitialPage] = useState<MenuOverlayProps['initialPage']>('root');
  const [apiOpen, setApiOpen] = useState(false);
  const [apiReturnPage, setApiReturnPage] = useState<MenuOverlayProps['initialPage']>('root');
  const [apiTesting, setApiTesting] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<null | { ok: boolean; message: string }>(null);
  const [apiBatchTestState, setApiBatchTestState] = useState<ProviderBatchConnectionTestState>(
    EMPTY_PROVIDER_BATCH_CONNECTION_TEST_STATE
  );
  const [collaboratorBuilderOpen, setCollaboratorBuilderOpen] = useState(false);
  const [collaboratorBuilderTargetId, setCollaboratorBuilderTargetId] = useState<string | null>(null);
  const [companionSetupOpen, setCompanionSetupOpen] = useState(false);

  return {
    menuOpen,
    setMenuOpen,
    menuInitialPage,
    setMenuInitialPage,
    apiOpen,
    setApiOpen,
    apiReturnPage,
    setApiReturnPage,
    apiTesting,
    setApiTesting,
    apiTestResult,
    setApiTestResult,
    apiBatchTestState,
    setApiBatchTestState,
    collaboratorBuilderOpen,
    setCollaboratorBuilderOpen,
    collaboratorBuilderTargetId,
    setCollaboratorBuilderTargetId,
    companionSetupOpen,
    setCompanionSetupOpen
  };
}
