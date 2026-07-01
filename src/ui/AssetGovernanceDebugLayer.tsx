import { AssetGovernanceOverlay } from './AssetGovernanceOverlay';
import { useAssetGovernanceDebugState } from './useAssetGovernanceDebugState';

type AssetGovernanceDebugLayerProps = {
  onClose: () => void;
};

export function AssetGovernanceDebugLayer({ onClose }: AssetGovernanceDebugLayerProps) {
  const assetGovernanceDebug = useAssetGovernanceDebugState();
  return <AssetGovernanceOverlay {...assetGovernanceDebug} onClose={onClose} />;
}
