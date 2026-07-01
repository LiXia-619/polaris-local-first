import type { ReactNode } from 'react';
import { AppTopbar, type AppTopbarProps } from '../shell/AppTopbar';

type MobileAppShellFrameProps = {
  topbarProps: AppTopbarProps;
  children: ReactNode;
};

export function MobileAppShellFrame({
  topbarProps,
  children
}: MobileAppShellFrameProps) {
  return (
    <div className="app-stage">
      <AppTopbar {...topbarProps} />
      {children}
    </div>
  );
}
