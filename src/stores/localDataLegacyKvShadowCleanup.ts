import { LOCAL_DATA_NAMESPACE } from '../engines/localData';
import { kvApplyMutations, kvKeysWithPrefix } from '../infrastructure/persistence';
import { isStoreLocalDataBackendInstalled } from './storeLocalDataBackendHost';

export async function clearLegacyLocalDataKvShadowIfStoreBackendInstalled() {
  if (!isStoreLocalDataBackendInstalled()) {
    return { cleared: false, deletedKeyCount: 0 };
  }

  const keys = await kvKeysWithPrefix(`${LOCAL_DATA_NAMESPACE}:`);
  if (keys.length === 0) {
    return { cleared: true, deletedKeyCount: 0 };
  }

  await kvApplyMutations(keys.map((key) => ({ type: 'delete', key })));
  return { cleared: true, deletedKeyCount: keys.length };
}
