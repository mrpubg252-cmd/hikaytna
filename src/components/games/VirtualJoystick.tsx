import React, { useRef, useState, useEffect } from 'react';

interface JoystickProps {
  onChange: (data: { x: number; y: number }) => void;
  onEnd: () => void;
  className?: string;
}

export function VirtualJoystick({ onChange, onEnd, className = '' }: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragCenter = useRef({ x: 0, y: 0 });

  const maxRadius = 35; // max displacement in pixels for compact feel

  const handleStart = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    dragCenter.current = { x: centerX, y: centerY };
    setIsDragging(true);
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const dx = clientX - dragCenter.current.x;
    const dy = clientY - dragCenter.current.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    let finalX = dx;
    let finalY = dy;

    if (distance > maxRadius) {
      finalX = (dx / distance) * maxRadius;
      finalY = (dy / distance) * maxRadius;
    }

    setKnobPos({ x: finalX, y: finalY });
    
    // Normalize ratio value from -1 to 1
    onChange({ x: finalX / maxRadius, y: finalY / maxRadius });
  };

  const handleEnd = () => {
    setIsDragging(false);
    setKnobPos({ x: 0, y: 0 });
    onEnd();
  };

  useEffect(() => {
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches[0]) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleMove(e.clientX, e.clientY);
      }
    };

    const handleGlobalEnd = () => {
      if (isDragging) {
        handleEnd();
      }
    };

    if (isDragging) {
      window.addEventListener('touchmove', handleGlobalTouchMove, { passive: false });
      window.addEventListener('mousemove', handleGlobalMouseMove);
      window.addEventListener('touchend', handleGlobalEnd);
      window.addEventListener('mouseup', handleGlobalEnd);
    }

    return () => {
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('touchend', handleGlobalEnd);
      window.removeEventListener('mouseup', handleGlobalEnd);
    };
  }, [isDragging]);

  return (
    <div 
      ref={containerRef}
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onTouchStart={(e) => {
        if (e.touches[0]) handleStart(e.touches[0].clientX, e.touches[0].clientY);
      }}
      className={`w-20 h-20 rounded-full bg-black/80 backdrop-blur-md border-2 border-primary/40 flex items-center justify-center relative touch-none cursor-pointer shadow-[0_0_25px_rgba(229,9,20,0.3)] ${className}`}
    >
      {/* Visual background guide circles */}
      <div className="absolute inset-2 rounded-full border border-dashed border-white/5 pointer-events-none" />
      {/* Interactive Floating Joystick red Knob */}
      <div 
        className="w-8 h-8 rounded-full bg-gradient-to-b from-primary to-rose-700 shadow-md border border-white/20 flex items-center justify-center pointer-events-none transition-transform duration-75"
        style={{
          transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
        }}
      >
        <div className="w-3 h-3 rounded-full bg-white/25" />
      </div>
    </div>
  );
}
