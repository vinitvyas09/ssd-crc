"use client";

import React from "react";

export function TavilySearch() {
  return (
    <div className="flex items-center space-x-2 py-2 px-3 bg-blue-50 dark:bg-blue-950/30 rounded-md border border-blue-100 dark:border-blue-900/50 mb-2">
      <div className="text-sm font-medium text-blue-700 dark:text-blue-400">
        Searching the web...
      </div>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
    </div>
  );
} 