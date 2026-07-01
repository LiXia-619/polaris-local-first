export const CONVERSATION_SCENARIOS = [
  {
    id: 'bubble_stack',
    label: '气泡连续叠加',
    activeWorld: 'chat',
    collectionShelf: 'code',
    turns: [
      {
        user: '把气泡改成圆的。',
        expectedAliases: ['chat-bubble-user', 'chat-bubble-assistant', 'chat-bubble-shared'],
        requireTool: true
      },
      {
        user: '再浮起来一点。',
        expectedAliases: ['chat-bubble-user', 'chat-bubble-assistant', 'chat-bubble-shared'],
        requireTool: true
      },
      {
        user: '要气泡完全没有框线。',
        expectedAliases: [
          'chat-bubble-user',
          'chat-bubble-assistant',
          'chat-bubble-shared'
        ],
        requireTool: true
      }
    ]
  },
  {
    id: 'chat_soften_then_tighten',
    label: '先柔和后收边',
    activeWorld: 'chat',
    collectionShelf: 'code',
    turns: [
      {
        user: '先把整个聊天区弄得柔一点。',
        expectedAliases: ['chat-bubble-user', 'chat-bubble-assistant', 'chat-bubble-shared'],
        requireTool: true
      },
      {
        user: '背景先别动，只收气泡外层。',
        expectedAliases: ['chat-bubble-user', 'chat-bubble-assistant', 'chat-bubble-shared'],
        forbiddenAliases: ['chat-background', 'app-background'],
        requireTool: true
      },
      {
        user: '那字再利落一点，思考框也压低一点。',
        expectedAliases: ['chat-system-note', 'app-preview-banner'],
        requireTool: true
      }
    ]
  },
  {
    id: 'chat_banner_then_bubble',
    label: '先压整体再点提示',
    activeWorld: 'chat',
    collectionShelf: 'code',
    turns: [
      {
        user: '先把整个聊天页调得安静一点。',
        expectedAliases: ['chat-background', 'app-background'],
        requireTool: true
      },
      {
        user: '顶部那条提示别太跳。',
        expectedAliases: ['app-preview-banner', 'chat-system-note'],
        requireTool: true
      },
      {
        user: '气泡还是保持刚才那种圆润感就行。',
        expectedAliases: ['chat-bubble-user', 'chat-bubble-assistant', 'chat-bubble-shared'],
        requireTool: true
      }
    ]
  },
  {
    id: 'collection_followthrough',
    label: '收藏卡连续跟进',
    activeWorld: 'collection',
    collectionShelf: 'code',
    turns: [
      {
        user: '我想收藏卡全部看上去凹进去。',
        expectedAliases: ['collection-card', 'collection-code-card', 'collection-dialogue-card'],
        requireTool: true
      },
      {
        user: '我想收藏卡前两张是镭射质感剩下彩色。',
        expectedAliases: ['collection-card', 'collection-code-card'],
        requireTool: true
      },
      {
        user: '背景别跟着变。',
        expectedAliases: ['collection-card', 'collection-code-card'],
        forbiddenAliases: ['collection-background', 'app-background'],
        requireTool: true
      }
    ]
  },
  {
    id: 'collection_soft_then_background',
    label: '收藏页先轻后收底',
    activeWorld: 'collection',
    collectionShelf: 'code',
    turns: [
      {
        user: '先把收藏页调得轻一点。',
        expectedAliases: ['collection-background', 'collection-card', 'collection-code-card'],
        requireTool: true
      },
      {
        user: '卡片先别换，底色收一下就行。',
        expectedAliases: ['collection-background'],
        forbiddenAliases: ['collection-card', 'collection-code-card', 'collection-dialogue-card'],
        requireTool: true
      },
      {
        user: '对，代码卡再比对话卡更醒目一点。',
        expectedAliases: ['collection-code-card', 'collection-card'],
        requireTool: true
      }
    ]
  },
  {
    id: 'whole_then_local',
    label: '整体后接局部',
    activeWorld: 'chat',
    collectionShelf: 'code',
    turns: [
      {
        user: '你可不可以给我换一整套框线和颜色。',
        requireTool: true
      },
      {
        user: '把气泡改成圆的。',
        expectedAliases: ['chat-bubble-user', 'chat-bubble-assistant', 'chat-bubble-shared'],
        requireTool: true
      },
      {
        user: '你可不可以吧系统那个通知换成黑色。',
        expectedAliases: ['app-preview-banner', 'chat-system-note'],
        requireTool: true
      }
    ]
  },
  {
    id: 'paper_tape_then_trim',
    label: '纸胶带风后续收边',
    activeWorld: 'chat',
    collectionShelf: 'code',
    turns: [
      {
        user: '我要全都是纸胶带彩色质感的。',
        requireTool: true
      },
      {
        user: '要气泡完全没有框线。',
        expectedAliases: ['chat-bubble-user', 'chat-bubble-assistant', 'chat-bubble-shared'],
        requireTool: true
      },
      {
        user: '你可不可以吧系统那个通知换成黑色。',
        expectedAliases: ['app-preview-banner', 'chat-system-note'],
        requireTool: true
      }
    ]
  }
];
