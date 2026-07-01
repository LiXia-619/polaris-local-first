import DESK_LAMP_ROOM_HTML from './deskLampRoom.html?raw';

export const DESK_LAMP_ROOM_CARD_ID = 'card-desk-lamp-room';

export const DESK_LAMP_ROOM_CARD_FACE_CSS = `
& {
  position: relative;
  min-height: 136px;
  border-radius: 24px;
  overflow: hidden;
  background:
    radial-gradient(circle at 18% 10%, rgba(255, 230, 174, 0.34), transparent 34%),
    radial-gradient(circle at 88% 8%, rgba(232, 243, 223, 0.46), transparent 32%),
    linear-gradient(180deg, rgba(255, 252, 243, 0.98) 0%, rgba(248, 238, 222, 0.94) 100%);
  border: 1.5px solid rgba(211, 168, 118, 0.34);
  box-shadow:
    0 18px 42px rgba(122, 92, 58, 0.12),
    inset 0 1px 0 rgba(255, 255, 255, 0.82);
  color: rgba(93, 73, 53, 0.84);
}

&::before {
  content: "";
  position: absolute;
  inset: 10px;
  border-radius: 18px;
  border: 1px solid rgba(190, 148, 95, 0.14);
  background:
    linear-gradient(rgba(143, 105, 67, 0.045) 1px, transparent 1px),
    linear-gradient(90deg, rgba(143, 105, 67, 0.035) 1px, transparent 1px);
  background-size: 20px 20px;
  pointer-events: none;
  z-index: 1;
}

&::after {
  content: "";
  width: 76px;
  height: 76px;
  position: absolute;
  right: -24px;
  top: -28px;
  border-radius: 999px;
  background: rgba(255, 232, 176, 0.32);
  filter: blur(3px);
  pointer-events: none;
  z-index: 1;
}

& .code-card-main {
  position: relative;
  z-index: 2;
  min-height: 136px;
  padding: 14px 15px 12px;
}

& .card-meta-row small {
  color: rgba(107, 87, 65, 0.42);
  font-weight: 680;
  letter-spacing: 0.12em;
}

& h3 {
  color: rgba(152, 98, 60, 0.96);
  font-size: 17px;
  font-weight: 760;
  line-height: 1.12;
}

& .code-card-origin {
  color: rgba(104, 82, 61, 0.62);
  font-size: 12px;
  line-height: 1.38;
  margin-top: 5px;
}

& .code-card-snippet {
  color: rgba(116, 102, 86, 0.28);
  max-height: 31px;
  overflow: hidden;
  font-size: 11px;
  line-height: 1.35;
  letter-spacing: 0.04em;
  opacity: 0.8;
  mask-image: linear-gradient(to bottom, black 0%, black 48%, transparent 100%);
}

& .tags {
  position: relative;
  z-index: 2;
  margin-top: auto;
  padding-right: 32px;
}

& .tags span {
  border: 1px solid rgba(204, 158, 103, 0.24);
  background: rgba(255, 250, 238, 0.72);
  color: rgba(130, 91, 58, 0.7);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.46);
}

& .code-card-run-dot::before {
  inset: 7px;
  border-color: rgba(204, 164, 112, 0.36);
  background: rgba(255, 255, 250, 0.94);
  box-shadow: 0 8px 18px rgba(116, 87, 56, 0.16);
}

& .code-card-run-dot {
  color: rgba(103, 80, 60, 0.72);
}
`;

export { DESK_LAMP_ROOM_HTML };
