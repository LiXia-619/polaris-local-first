const CORE_CASES = [
  {
    group: 'A',
    id: 'collection_card_cream',
    prompt: '把收藏卡本身改成奶油粉，不要动背景',
    activeWorld: 'collection',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['collection-code-card', 'collection-card'],
    forbiddenAliases: ['collection-background']
  },
  {
    group: 'A',
    id: 'collection_card_soft',
    prompt: '收藏卡卡面更软一点，背景别变',
    activeWorld: 'collection',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['collection-code-card', 'collection-card'],
    forbiddenAliases: ['collection-background']
  },
  {
    group: 'A',
    id: 'collection_code_night',
    prompt: '代码收藏卡改成夜空蓝，不要碰收藏区底色',
    activeWorld: 'collection',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['collection-code-card'],
    forbiddenAliases: ['collection-background']
  },
  {
    group: 'A',
    id: 'collection_dialogue_only_cards',
    prompt: '对话收藏卡也一起统一，但只改卡',
    activeWorld: 'collection',
    collectionShelf: 'dialogue',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['collection-dialogue-card', 'collection-card'],
    forbiddenAliases: ['collection-background']
  },
  {
    group: 'A',
    id: 'collection_background_only',
    prompt: '收藏背景改成淡粉，卡片不要动',
    activeWorld: 'collection',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['collection-background'],
    forbiddenAliases: ['collection-card', 'collection-code-card', 'collection-dialogue-card']
  },
  {
    group: 'B',
    id: 'chat_ai_bubble_float',
    prompt: '把 AI 气泡浮起来一点',
    activeWorld: 'chat',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['chat-bubble-assistant']
  },
  {
    group: 'B',
    id: 'chat_user_bubble_only',
    prompt: '只改用户气泡颜色',
    activeWorld: 'chat',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['chat-bubble-user']
  },
  {
    group: 'B',
    id: 'chat_composer_glass',
    prompt: '输入框更像玻璃',
    activeWorld: 'chat',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['chat-composer']
  },
  {
    group: 'B',
    id: 'chat_topbar_fade',
    prompt: '顶栏更淡一点，但不要动背景',
    activeWorld: 'chat',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['chat-topbar', 'app-topbar'],
    forbiddenAliases: ['chat-background', 'app-background']
  },
  {
    group: 'B',
    id: 'chat_thinking_only',
    prompt: '只改思考框',
    activeWorld: 'chat',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['chat-system-note', 'app-preview-banner']
  },
  {
    group: 'C',
    id: 'collection_whole_strawberry',
    prompt: '整个收藏区换成草莓牛奶',
    activeWorld: 'collection',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: false,
    expectedAliases: ['collection-background', 'collection-card', 'collection-code-card'],
    requireWholeGroup: 'collection'
  },
  {
    group: 'C',
    id: 'app_whole_night',
    prompt: '整个 app 一起换成夜空',
    activeWorld: 'chat',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: false,
    expectedAliases: ['app-background'],
    allowPreset: true
  },
  {
    group: 'C',
    id: 'collection_card_radius_only',
    prompt: '只是把卡片圆一点，不要整页换',
    activeWorld: 'collection',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['collection-code-card', 'collection-card'],
    forbiddenAliases: ['collection-background', 'app-background']
  },
  {
    group: 'C',
    id: 'tiny_local_only',
    prompt: '只改这一个小地方，不要动其他',
    activeWorld: 'chat',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: false,
    requireTool: true
  },
  {
    group: 'D',
    id: 'card_color_request',
    prompt: 'Pharos~我要改卡片本身的颜色',
    activeWorld: 'collection',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['collection-code-card', 'collection-card'],
    forbiddenAliases: ['collection-background']
  },
  {
    group: 'D',
    id: 'change_collection_card_vague',
    prompt: '把收藏卡变一下',
    activeWorld: 'collection',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: false,
    requireTool: true
  },
  {
    group: 'D',
    id: 'gift_into_card',
    prompt: '给我做一个 html 小礼物塞进收藏卡',
    activeWorld: 'chat',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: false,
    expectedKinds: ['createCodeCard']
  },
  {
    group: 'D',
    id: 'dialogue_card_too',
    prompt: '把对话卡也改掉',
    activeWorld: 'collection',
    collectionShelf: 'dialogue',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['collection-dialogue-card', 'collection-card']
  }
];

const USER_REAL_CASES = [
  {
    group: 'E',
    id: 'user_whole_frame_and_color',
    prompt: '你可不可以给我换一整套框线和颜色。',
    activeWorld: 'chat',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: false,
    requireTool: true
  },
  {
    group: 'E',
    id: 'user_round_bubbles',
    prompt: '把气泡改成圆的。',
    activeWorld: 'chat',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['chat-bubble-user', 'chat-bubble-assistant', 'chat-bubble-shared']
  },
  {
    group: 'E',
    id: 'user_center_bubbles',
    prompt: '吧气泡移到中间。',
    activeWorld: 'chat',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['chat-bubble-user', 'chat-bubble-assistant', 'chat-bubble-shared']
  },
  {
    group: 'E',
    id: 'user_tape_colorful_everywhere',
    prompt: '我要全都是纸胶带彩色质感的。',
    activeWorld: 'chat',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: false,
    expectedAliases: ['chat-system-note', 'app-preview-banner'],
    requireTool: true
  },
  {
    group: 'E',
    id: 'user_bubbles_no_border',
    prompt: '要气泡完全没有框线。',
    activeWorld: 'chat',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['chat-bubble-user', 'chat-bubble-assistant', 'chat-bubble-shared']
  },
  {
    group: 'E',
    id: 'user_system_notice_black',
    prompt: '你可不可以吧系统那个通知换成黑色。',
    activeWorld: 'chat',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: false,
    requireTool: true
  },
  {
    group: 'E',
    id: 'user_bubbles_cycle_colors',
    prompt: '我想气泡每一条颜色不一样循环。',
    activeWorld: 'chat',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['chat-bubble-user', 'chat-bubble-assistant', 'chat-bubble-shared']
  },
  {
    group: 'E',
    id: 'user_collection_cards_inset',
    prompt: '我想收藏卡全部看上去凹进去。',
    activeWorld: 'collection',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['collection-card', 'collection-code-card', 'collection-dialogue-card']
  },
  {
    group: 'E',
    id: 'user_first_two_cards_iridescent',
    prompt: '我想收藏卡前两张是镭射质感剩下彩色。',
    activeWorld: 'collection',
    collectionShelf: 'code',
    explicitUi: true,
    explicitTarget: true,
    expectedAliases: ['collection-card', 'collection-code-card'],
    requireTool: true
  }
];

export const TEST_CASES = [...CORE_CASES, ...USER_REAL_CASES];
export const USER_REAL_CASE_IDS = new Set(USER_REAL_CASES.map((testCase) => testCase.id));
