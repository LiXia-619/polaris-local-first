import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';

export function useIosKeyboardAccessoryBar() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'ios') return;
    void Keyboard.setAccessoryBarVisible({ isVisible: false });
  }, []);
}
