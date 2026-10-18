import {useCallback, useEffect} from 'react';
import {loadIssue} from '../storage.js';

/** Short toasts, and the one that reports an unreadable autosave. */
export function useNotify(wb) {
  const {notifyTimer, setToast} = wb;
  const notify = useCallback(s => {
    setToast(s);
    clearTimeout(notifyTimer.current);
    notifyTimer.current = setTimeout(() => setToast(''), 4000);
  }, []);
  useEffect(() => {
    if (loadIssue.message) {
      notify(loadIssue.message);
      loadIssue.message = '';
    }
  }, []);
  return {notify};
}
