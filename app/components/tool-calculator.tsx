"use client";

import React from "react";

export function Calculator() {
  return (
    <div className="flex items-center space-x-2 py-2 px-3 bg-amber-50 dark:bg-amber-950/30 rounded-md border border-amber-100 dark:border-amber-900/50 mb-2">
      <div className="text-sm font-medium text-amber-700 dark:text-amber-400">
        Using calculator...
      </div>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-amber-500 dark:bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-amber-500 dark:bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-amber-500 dark:bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  );
} 