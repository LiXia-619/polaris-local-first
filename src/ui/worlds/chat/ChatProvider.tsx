import { ChatContextProvider } from './context/ChatContext';
import type { ChatUiState } from './context/ChatUiState';
import { useChatProviderEffects } from './effects/useChatProviderEffects';
import { useChatProviderController } from './useChatProviderController';

type ChatProviderProps = {
  shell: {
    isActiveWorld: boolean;
    openToolbox: () => void;
    openProviderSettings: () => void;
  };
  ui: ChatUiState;
  children: React.ReactNode;
};

export function ChatProvider({ shell, ui, children }: ChatProviderProps) {
  const controller = useChatProviderController({
    isActiveWorld: shell.isActiveWorld,
    openToolbox: shell.openToolbox,
    openProviderSettings: shell.openProviderSettings,
    ui
  });

  useChatProviderEffects({
    ui: controller.ui,
    store: controller.store,
    derived: controller.derived
  });

  return <ChatContextProvider value={controller.value}>{children}</ChatContextProvider>;
}
