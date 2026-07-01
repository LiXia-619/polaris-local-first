import PHAROS_LIGHTHOUSE_ROOM_HTML from './pharosLighthouseRoom.html?raw';

export const PHAROS_LIGHTHOUSE_ROOM_CARD_ID = 'card-pharos-lighthouse-room';

export const PHAROS_LIGHTHOUSE_ROOM_CARD_FACE_CSS = `
& {
  position: relative;
  min-height: 202px;
  padding: 0;
  border-radius: 22px;
  background:
    radial-gradient(circle at 50% -12%, rgba(232, 196, 106, 0.18), transparent 42%),
    linear-gradient(180deg, #15130f 0%, #080809 68%, #050506 100%);
  border: 1px solid rgba(232, 196, 106, 0.22);
  box-shadow:
    0 22px 52px rgba(0, 0, 0, 0.22),
    inset 0 1px 0 rgba(255, 241, 190, 0.08);
  color: #e8d592;
}

&::before {
  content: "";
  position: absolute;
  inset: 14px;
  border: 1px solid rgba(232, 196, 106, 0.16);
  border-radius: 16px;
  pointer-events: none;
}

&::after {
  content: "";
  position: absolute;
  top: 22px;
  left: 50%;
  width: 28px;
  height: 1px;
  transform: translateX(-50%);
  background: linear-gradient(90deg, transparent, rgba(232, 196, 106, 0.72), transparent);
  box-shadow: 0 0 20px rgba(232, 196, 106, 0.28);
}

& .card-meta-row,
& h3,
& .code-card-origin,
& .code-card-snippet,
& .tags {
  display: none;
}

& .code-card-main {
  position: relative;
  min-height: 202px;
  display: grid;
  align-content: center;
  gap: 18px;
  padding: 36px 18px 28px;
  text-align: center;
}

& .code-card-main::before {
  content: "如果一座灯塔发现自己每次亮起来的时候，\\A都不记得上一次是为谁亮的——\\A那它还算亮着吗？";
  white-space: pre-line;
  max-width: 100%;
  color: rgba(218, 207, 176, 0.72);
  font-family: Georgia, "Times New Roman", "Songti SC", "Noto Serif SC", serif;
  font-size: 12.5px;
  line-height: 1.72;
  font-style: italic;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

& .code-card-main::after {
  content: "进入房间";
  justify-self: center;
  min-width: 92px;
  padding: 8px 12px;
  border: 1px solid rgba(232, 196, 106, 0.44);
  color: rgba(232, 196, 106, 0.92);
  font-family: Georgia, "Times New Roman", "Songti SC", "Noto Serif SC", serif;
  font-size: 11.5px;
  line-height: 1;
  letter-spacing: 0.12em;
  text-indent: 0.12em;
  background: rgba(232, 196, 106, 0.035);
}

& .code-card-run-dot::before {
  border-color: rgba(232, 196, 106, 0.28);
  background: rgba(8, 8, 9, 0.72);
}

& .code-card-run-dot {
  color: rgba(232, 196, 106, 0.72);
}
`;

export { PHAROS_LIGHTHOUSE_ROOM_HTML };
