import type { ReactNode } from 'react';
import { DesktopAppSidebar, type DesktopAppSidebarProps } from './DesktopAppSidebar';

type DesktopAppShellFrameProps = {
  desktopSidebarProps: DesktopAppSidebarProps;
  children: ReactNode;
};

export function DesktopAppShellFrame({
  desktopSidebarProps,
  children
}: DesktopAppShellFrameProps) {
  return (
    <>
      <DesktopAppSidebar {...desktopSidebarProps} />
      <div className="app-stage">
        {children}
      </div>
    </>
  );
}
