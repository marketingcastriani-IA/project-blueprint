# AI Development Rules - OpçõesX

## Tech Stack
- **Framework**: React 18 with TypeScript and Vite.
- **Styling**: Tailwind CSS for all styling, using CSS variables for theme consistency.
- **UI Components**: shadcn/ui (built on Radix UI) for accessible, high-quality components.
- **Icons**: Lucide React for all iconography.
- **Routing**: React Router DOM (v6+) for client-side navigation.
- **Backend/Auth**: Supabase for authentication, database, and Edge Functions.
- **Data Fetching**: TanStack Query (React Query) for server state management.
- **Charts**: Recharts for financial data visualization (Payoff curves).
- **Notifications**: Sonner for toast notifications.
- **Validation**: Zod for schema validation and type safety.

## Library Usage Rules
- **UI Components**: Always check `src/components/ui/` before creating new components. Use shadcn/ui patterns.
- **Icons**: Use `lucide-react`. Do not install other icon libraries unless strictly necessary.
- **State Management**: Use React Context for global UI state (Auth, Theme). Use TanStack Query for anything coming from Supabase.
- **Styling**: Use Tailwind utility classes. Avoid writing raw CSS in `.css` files unless defining global variables or complex animations.
- **Forms**: Use `react-hook-form` combined with `zod` for form handling and validation.
- **Toasts**: Use `sonner` for user feedback (success, error, info).

## Project Structure
- **Pages**: All route-level components must live in `src/pages/`.
- **Components**: Reusable UI elements live in `src/components/`.
- **Logic/Utils**: Business logic, math (payoff calculations), and helpers live in `src/lib/`.
- **Hooks**: Custom React hooks live in `src/hooks/`.
- **Contexts**: Global providers live in `src/contexts/`.
- **Supabase**: Database types and client initialization live in `src/integrations/supabase/`.

## Coding Standards
- **TypeScript**: Use strict typing. Avoid `any`. Define interfaces in `src/lib/types.ts` for shared data structures.
- **Components**: Prefer functional components with arrow functions. Use `useMemo` and `useCallback` for performance-heavy calculations (like payoff curves).
- **Responsiveness**: All UI must be mobile-first and fully responsive using Tailwind's breakpoint prefixes (`sm:`, `md:`, `lg:`).
- **Naming**: Use PascalCase for components and files, camelCase for variables and functions.
- **Financial Precision**: Always handle currency and strikes with appropriate rounding (usually 2 decimal places) using `toFixed(2)` or math helpers in `src/lib/payoff.ts`.