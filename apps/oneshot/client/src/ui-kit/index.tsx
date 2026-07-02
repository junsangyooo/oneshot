import { useEffect } from "react";

/* Transient notice (bottom-right). Auto-dismisses after a few seconds;
   clicking dismisses immediately. A new message restarts the timer. */
const TOAST_DISMISS_MS = 4000;

export const Toast = ({ message, onClose }: { message: string | null; onClose: () => void }) => {
  useEffect(() => {
    if (message == null) return;
    const id = setTimeout(onClose, TOAST_DISMISS_MS);
    return () => clearTimeout(id);
  }, [message, onClose]);

  return message ? (
    <button className="toast" type="button" onClick={onClose}>
      {message}
    </button>
  ) : null;
};
