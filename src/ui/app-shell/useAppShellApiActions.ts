import { useEffect, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { testApiConnection } from '../../engines/chatApi';
import type { ProviderProfile } from '../../types/domain';
import {
  EMPTY_PROVIDER_BATCH_CONNECTION_TEST_STATE,
  runProviderBatchConnectionTest,
  type ProviderBatchConnectionTestState
} from '../../app/shell/providerBatchConnectionTest';
import { useI18n } from '../../i18n/useI18n';

type AppShellApiActionsArgs = {
  api: ProviderProfile;
  activeProviderId: string | null;
  providers: ProviderProfile[];
  createProvider: (namePrefix?: string) => void;
  importProvider: (provider: Partial<ProviderProfile>) => void;
  duplicateProvider: (providerId: string, duplicateName?: string) => void;
  deleteProvider: (providerId: string) => void;
  setApiConfig: (patch: Partial<ProviderProfile>) => void;
  setActiveProvider: (providerId: string) => void;
  setApiTesting: Dispatch<SetStateAction<boolean>>;
  setApiTestResult: Dispatch<SetStateAction<null | { ok: boolean; message: string }>>;
  setApiBatchTestState: Dispatch<SetStateAction<ProviderBatchConnectionTestState>>;
};

export function useAppShellApiActions({
  api,
  activeProviderId,
  providers,
  createProvider,
  importProvider,
  duplicateProvider,
  deleteProvider,
  setApiConfig,
  setActiveProvider,
  setApiTesting,
  setApiTestResult,
  setApiBatchTestState
}: AppShellApiActionsArgs) {
  const { t } = useI18n();
  const apiTestRequestIdRef = useRef(0);
  const apiBatchTestRequestIdRef = useRef(0);

  useEffect(() => {
    apiTestRequestIdRef.current += 1;
    setApiTesting(false);
    setApiTestResult(null);
  }, [
    activeProviderId,
    api.baseUrl,
    api.path,
    api.apiKey,
    api.model,
    api.capabilities.images,
    api.capabilities.streaming,
    api.capabilities.thinking,
    setApiTesting,
    setApiTestResult
  ]);

  useEffect(() => {
    apiBatchTestRequestIdRef.current += 1;
    setApiBatchTestState(EMPTY_PROVIDER_BATCH_CONNECTION_TEST_STATE);
  }, [providers, setApiBatchTestState]);

  const runApiTest = async () => {
    const requestId = apiTestRequestIdRef.current + 1;
    apiTestRequestIdRef.current = requestId;
    setApiTesting(true);
    setApiTestResult(null);
    const result = await testApiConnection({
      api
    });
    if (apiTestRequestIdRef.current !== requestId) {
      setApiTesting(false);
      return;
    }
    setApiTestResult(result.ok ? { ok: true, message: result.message ?? t('apiProvider.batch.connected') } : { ok: false, message: result.error });
    setApiTesting(false);
  };

  const runProviderBatchTest = async () => {
    const requestId = apiBatchTestRequestIdRef.current + 1;
    apiBatchTestRequestIdRef.current = requestId;
    await runProviderBatchConnectionTest({
      providers,
      testProvider: (provider) => testApiConnection({ api: provider }),
      copy: {
        missingModel: t('apiProvider.batch.missingModel'),
        queued: t('apiProvider.batch.queued'),
        empty: t('apiProvider.batch.empty'),
        running: t('apiProvider.batch.running'),
        missingProvider: t('apiProvider.batch.missingProvider'),
        connected: t('apiProvider.batch.connected'),
        doneWithFailures: (failed, passed) => t('apiProvider.batch.doneWithFailures', { failed, passed }),
        doneSuccess: (passed) => t('apiProvider.batch.doneSuccess', { passed }),
        reportTitle: t('apiProvider.batch.reportTitle'),
        reportResult: (message) => t('apiProvider.batch.reportResult', { message }),
        reportProgress: (state) => t('apiProvider.batch.reportProgress', state)
      },
      onProgress: (state) => {
        if (apiBatchTestRequestIdRef.current === requestId) {
          setApiBatchTestState(state);
        }
      }
    });
  };

  return {
    runApiTest,
    runProviderBatchTest,
    providerActions: {
      onSetActiveProvider: setActiveProvider,
      onCreateProvider: (namePrefix?: string) => {
        createProvider(namePrefix);
        setApiTestResult(null);
      },
      onImportProvider: (provider: Partial<ProviderProfile>) => {
        importProvider(provider);
        setApiTestResult(null);
      },
      onDuplicateProvider: (duplicateName?: string) => {
        if (activeProviderId) duplicateProvider(activeProviderId, duplicateName);
        setApiTestResult(null);
      },
      onDeleteProvider: () => {
        if (activeProviderId && providers.length > 1) deleteProvider(activeProviderId);
        setApiTestResult(null);
      },
      onSetApiConfig: setApiConfig
    }
  };
}
