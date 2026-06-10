import { useEffect } from "react";

export default function Toast({ message, onClose }) {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => {
        onClose();
      }, 2500); // 2.5 detik
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className="toast-overlay">
      <div className="toast-content">
        <span className="toast-icon">✓</span>
        {message}
      </div>
    </div>
  );
}
