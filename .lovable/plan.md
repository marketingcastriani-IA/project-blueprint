

## Plan: Integrate BoxTracker Component

### What
Add the uploaded **Rastreador de Box** component as a new page in the app, accessible via the navigation menu with a dedicated route `/box-tracker`.

### Steps

1. **Create the component file**
   - Copy `BoxTrackerTab.tsx` to `src/components/BoxTrackerTab.tsx`

2. **Create a new page `src/pages/BoxTracker.tsx`**
   - Wrap `BoxTrackerTab` inside `ProfessionalLayout` (same pattern as other pages)
   - Add PRO access control (same as DadosAoVivo) since this is a premium feature

3. **Add route in `App.tsx`**
   - Add `<Route path="/box-tracker" element={<BoxTracker />} />`

4. **Add nav item in `Header.tsx`**
   - Add "Rastreador Box" to `navItems` array with `BarChart2` icon, path `/box-tracker`
   - Place it after "Tempo Real" in the menu

### Technical Details
- The component is self-contained (881 lines) with its own types, mock API functions, and UI
- Uses only `lucide-react` and Tailwind — no extra dependencies needed
- Has a dark theme hardcoded (`bg-[#0a0e1a]`) which will work well with the app's dark mode; may need minor adjustments for light mode
- Mock data functions (`fetchOptionData`, `fetchStockPrice`) are included — can be replaced with real API later

