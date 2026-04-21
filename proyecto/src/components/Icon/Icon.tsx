import React from 'react';

interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
  style?: React.CSSProperties;
}

export const Icon: React.FC<IconProps> = ({ name, className = '', filled = false, style }) => {
  const fillStyle = filled ? { fontVariationSettings: "'FILL' 1" } : undefined;
  
  return (
    <span 
      className={`material-symbols-outlined ${className}`} 
      style={{ ...fillStyle, ...style }}
    >
      {name}
    </span>
  );
};
