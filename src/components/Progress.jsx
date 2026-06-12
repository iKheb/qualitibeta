import React from 'react';
import { Loader2 } from 'lucide-react';

export function ProgressBar({ value = 0, max = 100, status = 'active' }) {
  const percentage = Math.min((value / max) * 100, 100);
  
  return (
    <div className="progress-bar">
      <div
        className={`progress-bar-fill ${status}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

export function ProgressIndicator({ label, status, percentage, icon: Icon }) {
  return (
    <div className="progress-indicator">
      <div className={`progress-indicator-icon ${status}`}>
        {Icon ? <Icon size={20} /> : <Loader2 size={20} className="animate-spin" />}
      </div>
      <div className="progress-indicator-content">
        <div className="progress-indicator-label">{label}</div>
        <div className="progress-indicator-status">
          {status === 'active' && 'En progreso...'}
          {status === 'success' && 'Completado'}
          {status === 'error' && 'Error'}
        </div>
      </div>
      {percentage !== undefined && (
        <div className="progress-indicator-percentage">{percentage}%</div>
      )}
    </div>
  );
}

export function CircularProgress({ value = 0, max = 100, size = 48, status = 'active' }) {
  const percentage = Math.min((value / max) * 100, 100);
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="circular-progress" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="circular-progress-bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
        />
        <circle
          className={`circular-progress-fill ${status}`}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: offset,
          }}
        />
      </svg>
      <div className="circular-progress-text">{Math.round(percentage)}%</div>
    </div>
  );
}
