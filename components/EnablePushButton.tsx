'use client';

import { useCallback } from 'react';

declare global {
  interface Window {
    enablePushManually?: () => Promise<void>;
  }
}

export default function EnablePushButton() {
  const handleClick = useCallback(() => {
    // Calls the function we defined in the OneSignal init <Script>
    window.enablePushManually?.();
  }, []);

  return (
    <button
      className="btn secondary"
      style={{ marginLeft: 'auto', fontSize: 12 }}
      title="Enable notifications"
      onClick={handleClick}
    >
      Enable notifications
    </button>
  );
}
