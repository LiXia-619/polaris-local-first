export function appendEnteringMessageIds(
  currentIds: string[],
  nextIds: Array<string | null | undefined>
) {
  const appended = [...currentIds];

  nextIds.forEach((id) => {
    if (!id || appended.includes(id)) return;
    appended.push(id);
  });

  return appended;
}
