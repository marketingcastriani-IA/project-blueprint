import { useEffect, useCallback } from 'react';

interface ShortcutMap {
  [key: string]: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const handler = useCallback((e: KeyboardEvent) => {
    // Don't fire in inputs/textareas
    const tag = (e.target as HTMLElement).tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    const key = [
      e.ctrlKey || e.metaKey ? 'Ctrl' : '',
      e.shiftKey ? 'Shift' : '',
      e.key === 'Enter' ? 'Enter' : e.key === 'Escape' ? 'Escape' : e.key.toUpperCase(),
    ].filter(Boolean).join('+');

    const fn = shortcuts[key];
    if (fn) {
      e.preventDefault();
      fn();
    }
  }, [shortcuts]);

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}
