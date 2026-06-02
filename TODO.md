# TODO - GastosPro backend fix

## Step 1: Fix middleware import mismatch
- [x] `backend/routes/transactions.js` was importing `../middleware/authMiddleware` but the file is actually `aythMiddleware.js`.
- [x] Updated import to `../middleware/aythMiddleware`.

## Step 2: Runtime verification
- [ ] Verify `node`/`npm` availability and run `npm run dev` (could not run in this environment: `node`/`npm` not found).

## Step 3 (optional hardening)
- [ ] Add/verify `.env` variables and create `.env.example` for documentation.
- [ ] Consider renaming `aythMiddleware.js` -> `authMiddleware.js` for clarity and updating any remaining references.