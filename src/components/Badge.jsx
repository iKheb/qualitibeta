import React from 'react';

export function Badge({ children, variant = 'primary', showDot = false }) {
  return (
    <span className={`badge ${variant}`}>
      {showDot && <span className="badge-dot" />}
      {children}
    </span>
  );
}

export function Tag({ children, removable = false, onRemove }) {
  return (
    <span className={`tag ${removable ? 'removable' : ''}`}>
      {children}
      {removable && (
        <button className="tag-remove" onClick={onRemove}>
          ×
        </button>
      )}
    </span>
  );
}

export function NotificationBadge({ count }) {
  if (!count || count === 0) return null;
  
  return (
    <span className="notification-badge">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function StatusIndicator({ status, label }) {
  return (
    <span className="status-indicator">
      <span className={`status-indicator-dot ${status}`} />
      {label}
    </span>
  );
}
