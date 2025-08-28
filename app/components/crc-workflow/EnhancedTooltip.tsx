'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface TooltipData {
  x: number;
  y: number;
  content: string;
  targetRect?: DOMRect;
}

interface EnhancedTooltipProps {
  data: TooltipData | null;
  delay?: number;
}

export default function EnhancedTooltip({ data, delay = 200 }: EnhancedTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (data) {
      // Clear any existing timeout
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      
      // Show tooltip after a short delay for better UX
      timeoutRef.current = setTimeout(() => {
        setVisible(true);
        
        // Smart positioning
        const padding = 12;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        
        // Estimate tooltip size (will be refined after render)
        const estimatedWidth = 280;
        const estimatedHeight = 100;
        
        let x = data.x;
        let y = data.y;
        
        // Adjust X position to keep tooltip in viewport
        if (x + estimatedWidth + padding > viewportWidth) {
          x = Math.max(padding, viewportWidth - estimatedWidth - padding);
        }
        if (x < padding) {
          x = padding;
        }
        
        // Adjust Y position - prefer showing below cursor
        if (y + estimatedHeight + padding > viewportHeight) {
          // Show above cursor if not enough space below
          y = Math.max(padding, data.y - estimatedHeight - 20);
        }
        
        setPosition({ x, y });
      }, delay);
    } else {
      // Hide tooltip immediately when data is null
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setVisible(false);
    }

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [data, delay]);

  // Refine position after tooltip renders
  useEffect(() => {
    if (visible && tooltipRef.current && data) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const padding = 12;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      let newX = position.x;
      let newY = position.y;
      let adjusted = false;
      
      // Re-adjust if needed based on actual size
      if (rect.right > viewportWidth - padding) {
        newX = Math.max(padding, viewportWidth - rect.width - padding);
        adjusted = true;
      }
      
      if (rect.bottom > viewportHeight - padding) {
        newY = Math.max(padding, data.y - rect.height - 20);
        adjusted = true;
      }
      
      if (adjusted) {
        setPosition({ x: newX, y: newY });
      }
    }
  }, [visible, data, position]);

  if (!data) return null;

  return (
    <AnimatePresence mode="wait">
      {visible && (
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, scale: 0.95, y: -10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -10 }}
          transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
          className="fixed pointer-events-none z-[10000]"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
        >
          <div className="tooltip-content">
            <div dangerouslySetInnerHTML={{ __html: data.content }} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}