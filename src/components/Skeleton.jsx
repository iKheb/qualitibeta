import React from 'react';

export function Skeleton({ className, variant = 'text' }) {
  return <div className={`skeleton skeleton-${variant} ${className || ''}`} />;
}

export function SkeletonText({ lines = 3, className }) {
  return (
    <div className={className}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant={i === 0 ? 'large' : 'text'} />
      ))}
    </div>
  );
}

export function SkeletonAvatar() {
  return <Skeleton variant="avatar" />;
}

export function SkeletonCard({ showAvatar = false }) {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card-header">
        {showAvatar && <SkeletonAvatar />}
        <div style={{ flex: 1 }}>
          <Skeleton variant="large" />
          <Skeleton variant="text" />
        </div>
      </div>
      <div className="skeleton-card-body">
        <Skeleton variant="text" />
        <Skeleton variant="text" />
        <Skeleton variant="text" />
      </div>
    </div>
  );
}

export function SkeletonStat() {
  return (
    <div className="skeleton-stat">
      <Skeleton variant="text" className="skeleton-stat-label" />
      <Skeleton variant="large" className="skeleton-stat-value" />
    </div>
  );
}

export function SkeletonRow({ showIcon = false }) {
  return (
    <div className="skeleton-row">
      {showIcon && <div className="skeleton-row-icon" />}
      <div className="skeleton-row-content">
        <Skeleton variant="text" />
        <Skeleton variant="text small" />
      </div>
    </div>
  );
}
