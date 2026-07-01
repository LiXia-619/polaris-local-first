import type { AssistantToolContext } from './assistantToolProtocolTypes';

export function buildWorkspaceContextPrompt(context: AssistantToolContext | undefined): string {
  if (!context?.activeProject) return '';

  const lines = [
    `当前活动工作区：${context.activeProject.title} · slug=${context.activeProject.slug} · 文件数=${context.activeProject.fileCount}`
  ];

  if (context.activeProject.entryFilePath) {
    lines.push(`当前活动工作区入口：${context.activeProject.entryFilePath}`);
  }
  if (context.activeProject.desktopBinding) {
    const binding = context.activeProject.desktopBinding;
    lines.push(`当前活动工作区已绑定 Mac 本机文件夹：${binding.rootLabel} · rootId=${binding.rootId} · manifest=${binding.manifestPath} · 本机入口=${binding.entryFilePath}`);
    lines.push('桌面工作区同步是显式动作，不会自动把电脑文件回灌到手机；需要立即改真实电脑文件或运行命令时，仍使用本机文件工具和该 rootId。读入或送到电脑前，遇到同一文件两边都改过的覆盖风险必须先向用户确认，不能自行把 allowOverwrite 设为 true。');
  }
  if (context.activeProject.previewStateAccess?.assistantReadEnabled) {
    lines.push('当前工作区允许协作者读取托管预览状态；用户问预览里刚填了什么、当前页面状态或 PolarisRoom/localStorage 数据时，使用 readWorkspacePreviewState 读取宿主已保存的状态。');
  }

  lines.push('这轮默认继续复用这个工作区。');
  lines.push('当前是工作区上下文：只使用工作区文件工具；房间卡工具和 Polaris 界面换肤工具在这里不可用。');
  lines.push('房间卡和工作区文件不能交叉使用：不要调用 createCodeCard / patchCodeCard / appendCodeCard / editCodeCardText / readCodeCard；也不要把工作区文件写成收藏区房间卡。');
  lines.push('工作区里的 CSS 属于项目文件内容，写进当前工作区的 .css 文件、HTML <style> 或对应源码里；不要用界面换肤工具改 Polaris 外观。');
  if (context.visibleProjectFiles?.some((file) => file.projectId === context.activeProject?.id)) {
    lines.push('当前工作区有文件内容投影在对话上下文里；投影是当前事实的一部分，但不等于每个文件全文。readProjectFile 返回完整全文，readProjectFileContext 返回局部窗口；拿到行号后可以用 replaceProjectFileLines 替换完整行段。');
  }
  lines.push('工作区文件目录：');
  lines.push(
    ...context.activeProject.files.map((file, index) =>
      `${index + 1}. ${file.path} · ${file.language}${file.isEntry ? ' · entry' : ''}${file.role ? ` · role=${file.role}` : ''}`
    )
  );

  return lines.join('\n');
}
