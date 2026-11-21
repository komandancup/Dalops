---
name: adobe-stock-upload
description: Upload stock images (EPS/JPG + CSV metadata) to Adobe Stock Contributor through a browser where the user logs in manually. Use when the user asks to "upload to Adobe Stock", "upload adobe", "submit stock", or runs /adobe-stock-upload.
---

# Adobe Stock Upload (manual login, automated upload)

Run this on the **user's computer** (local Claude Code). It needs a visible browser window. A cloud session has no display, and port 22/SFTP is blocked there.

## Security rules (must follow)
- **Never** ask for, type in, or save the Adobe password. The user logs in themselves in the browser window.
- **Never** click **Submit** on Adobe. The script stops before Submit, and the user submits after reviewing.
- The login session is stored only in the local profile `~/.adobe-stock-profile`. Do not commit it or copy it anywhere.

## Steps
1. **Pick the folder.** The default is `christmas-stock/vector/upload/` (19 EPS + 1 JPG + `adobe_stock_metadata_upload.csv`). If the user names another batch, use that folder. It must contain the images and **exactly one** CSV with the columns `Filename,Title,Keywords,Category,Releases`.
2. **Validate:**
   ```bash
   node christmas-stock/upload/adobe-upload.cjs <folder> --check
   ```
   If there's a PROBLEM (file not in the CSV, CSV entry without a file, >45 MB), fix it or report it to the user before continuing.
3. **Check Playwright:** `node -e "require('playwright')"`. If it fails: `npm i -D playwright && npx playwright install chromium`.
4. **Run the upload.** The script waits for Enter at a few points, so ask the user to run it in their own terminal (in Claude Code: `! node christmas-stock/upload/adobe-upload.cjs <folder>`), or run it in the background and tell the user what to do at each prompt:
   1. Browser opens → the user **logs in** (email, password, 2FA) → Enter.
   2. The script uploads all the images → the user waits for processing to finish → Enter.
   3. The script uploads the CSV metadata.
   4. The script stops. The user does the final step by hand.
5. **Remind the user about the final step on the web:**
   - Refresh Uploads and make sure the titles and keywords are filled in.
   - File type: EPS → **Vectors**, JPG → **Illustrations**.
   - "Created using generative AI tools?" → **No** (the images were made from code).
   - Select all → **Submit**.
   - Do not upload the same design as both JPG and EPS (it gets rejected as *similar content*).

## If Adobe's layout has changed
The script looks for the **Upload** button, a `filechooser` / `input[type=file]`, the **Upload CSV** link and a dialog. If none of them is found, it does not fail. It asks the user to pick the files by hand and then continues. If this keeps happening, update the selectors in `pickFiles` / `main` in `christmas-stock/upload/adobe-upload.cjs`.

## Related files
- `christmas-stock/generate.py` → original SVGs, `render.cjs` → JPG, `vectorize.py` → EPS for Adobe.
- `christmas-stock/README.md` → full guide and marketing notes.
