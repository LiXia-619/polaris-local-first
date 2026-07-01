import { useGroupWorldController } from '../../app/group/useGroupWorldController';
import { useAssetObjectUrl } from '../useAssetObjectUrl';
import type { ChatUiState } from './chat/context/ChatUiState';
import { GroupHome } from './group/GroupHome';
import { GroupRoom } from './group/GroupRoom';
import { GroupLaneSheet } from './group/GroupLaneSheet';

export type GroupWorldProps = {
  shell: {
    isActiveWorld: boolean;
    isWorldSwitching: boolean;
    onExitToRoomSwitch?: () => void;
  };
  ui: ChatUiState;
};

export function GroupWorld({ shell, ui }: GroupWorldProps) {
  const controller = useGroupWorldController({ ui });
  const backgroundImageUrl = useAssetObjectUrl(
    controller.activeGroup?.group?.backgroundAssetId ?? undefined,
    true
  );

  if (!controller.ready) {
    return <section className="world world-group" aria-hidden="true" />;
  }

  const background = controller.activeGroup?.group?.background ?? 'aurora';
  const backgroundVeil = controller.activeGroup?.group?.backgroundVeil ?? 0.45;
  const laneMember = controller.laneMemberId
    ? controller.memberPersonas.find((member) => member.id === controller.laneMemberId) ?? null
    : null;

  return (
    <section
      className={`world world-group ${shell.isActiveWorld ? 'is-active' : ''}`}
      data-group-bg={background}
    >
      {backgroundImageUrl ? (
        <div
          className="group-backdrop-image"
          style={{ backgroundImage: `url(${backgroundImageUrl})`, opacity: backgroundVeil }}
          aria-hidden="true"
        />
      ) : null}
      {controller.view === 'home' ? (
        <GroupHome
          controller={controller}
          onExitWorld={() => {
            shell.onExitToRoomSwitch?.();
            controller.exitWorld();
          }}
        />
      ) : (
        <GroupRoom controller={controller} />
      )}
      {laneMember ? (
        <GroupLaneSheet controller={controller} member={laneMember} />
      ) : null}
      {controller.commandStatus ? (
        <div className={`group-command-status ${controller.commandStatus.isError ? 'is-error' : ''}`} role="status">
          {controller.commandStatus.text}
        </div>
      ) : null}
    </section>
  );
}
