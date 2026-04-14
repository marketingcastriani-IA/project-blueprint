

## Fix: Reply to Suggestions Error

**Root Cause**: In `src/pages/AdminPanel.tsx` line 78, the reply function sends `{ to, subject, html }` but the `send-admin-email` edge function (line 65) expects `{ to, subject, body }`. Since `body` is missing, the function returns 400 "Missing required fields".

**Change**: In `src/pages/AdminPanel.tsx`, rename the `html` key to `body` in the `handleReply` function's request body (line 78).

```tsx
// Before
body: {
  to: s.profile.email,
  subject: '...',
  html: `<div>...</div>`,   // WRONG key
}

// After  
body: {
  to: s.profile.email,
  subject: '...',
  body: `<div>...</div>`,   // Correct key
}
```

This is a single-line rename fix. No other files need changes.

