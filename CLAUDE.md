# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
- `npm run dev` - Start development server with Turbopack on http://localhost:3000
- `npm run build` - Production build with Turbopack
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Type Checking
TypeScript strict mode is enabled. Run type checking via:
- `npx tsc --noEmit` - Check types without emitting files

## Architecture

This is a Next.js 15 application using the App Router that visualizes CRC (Cyclic Redundancy Check) validation workflows for SSD computational storage. The application demonstrates three different architectural approaches for offloading CRC computation from hosts to SSDs.

### Key Components

1. **CRCWorkflowVisualizer** (`app/components/CRCWorkflowVisualizer.tsx`)
   - Main component that orchestrates the entire visualization
   - Manages application state and theme switching
   - Handles SVG/PNG export functionality

2. **Workflow Model Builder** (`app/utils/workflow-model-builder.ts`)
   - Builds the computational model for each of the three CRC solutions
   - Calculates timing, latencies, and generates events for visualization

3. **SVG Diagram** (`app/components/crc-workflow/SVGDiagram.tsx`)
   - Renders the swimlane sequence diagram
   - Handles interactive tooltips and visual feedback

4. **Control Panel** (`app/components/crc-workflow/ControlPanel.tsx`)
   - User interface for adjusting parameters and switching between solutions

### CRC Solutions Implemented

- **Solution 1**: Serial CRC with seeding - Sequential processing through SSDs
- **Solution 2**: Parallel CRC + Host Aggregation - Parallel SSD processing with host combining results  
- **Solution 3**: Parallel CRC + SSD Aggregation - Parallel processing with SSD-based aggregation

### Styling

- Uses Tailwind CSS v4 with PostCSS
- Dynamic theming with CSS variables for dark/light mode
- Inline styles in components for dynamic values

### Path Aliases

- `@/*` maps to the project root (configured in tsconfig.json)

### State Management

All state is managed locally using React hooks. The main state interface is `WorkflowState` in `app/types/crc-workflow.ts`.

## Code Conventions

- TypeScript strict mode enabled
- Use absolute imports with `@/` prefix
- Components use client-side rendering (`'use client'` directive)
- Prefer functional components with hooks
- Export default for page components, named exports for utilities