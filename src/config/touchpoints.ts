export const TOUCHPOINTS = {
  collection: [
    'create_card_manual',
    'filter_cards',
    'switch_collection_shelf',
    'switch_world_to_chat',
    'open_theme_studio',
    'open_dialogue_card'
  ],
  chat: [
    'send_message',
    'switch_world_to_collection',
    'open_persona_builder',
    'tool_call_change_theme',
    'apply_theme_preset',
    'open_attachment_slot'
  ],
  persona: ['create_persona', 'compile_prompt', 'bind_persona_to_conversation']
} as const;
