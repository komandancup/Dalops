# 20 Christmas Illustrations for Adobe Stock

Original vector illustrations (made from code, **not AI-generated**). They are ready to upload to Adobe Stock Contributor.

## Contents
- `jpg/`: 20 files ready to upload (18 at 6000×4000 px, 2 square patterns at 4800×4800 px). Adobe's minimum is 4 MP.
- `svg/`: vector source files. Open them in Illustrator or Inkscape and save as **EPS 10** to submit them as *Vectors* (vectors are usually priced higher).
- `adobe_stock_metadata.csv`: title, keywords (30 per image, most important first) and category, for a bulk import.
- `generate.py` + `render.cjs`: scripts to regenerate the images or change colours (`python3 generate.py && node render.cjs 4 jpg`).

## How to upload
1. contributor.stock.adobe.com, then **Upload**, then drag in all the files from `jpg/`.
2. Open the **Upload CSV** menu and pick `adobe_stock_metadata.csv`. Titles and keywords fill in automatically.
3. File type: **Illustrations**. Answer **No** to "Created using generative AI tools".
4. Check each file, then **Submit**.

## Upload timing
Adobe's review takes from a few days up to 2 weeks. Christmas buyers (agencies and designers) start searching in **September–October**. Images submitted now will catch the last-minute December demand and will be fully indexed for the 2027 season.

## Vector version (EPS), recommended
Folder `vector/upload/` is **ready to upload**: 19 EPS files + 1 JPG (`christmas_10_gold_bokeh`, because the bokeh effect needs blur, which is not allowed in Adobe vectors) + `adobe_stock_metadata_upload.csv`.
- Each EPS is clean: no transparency, no blur effects, no raster images, and all text is converted to outlines. Artboard is 6000×4000 pt.
- `vector/preview/` holds JPG previews of each EPS, for checking only and **not for upload**.
- Upload **only one format per design** (EPS *or* JPG). Uploading both usually gets rejected as similar content.
- When uploading, set the file type to **Vectors** (or **Illustrations** for #10) and answer **No** to generative AI.
- Regenerate: `python3 vectorize.py` (needs `pip install cairosvg fonttools lxml`).

## Automated upload (manual login)
On your own computer, in Claude Code, type `/adobe-stock-upload`, or run it directly:
```bash
npm i -D playwright && npx playwright install chromium   # once
node christmas-stock/upload/adobe-upload.cjs --check       # validate files + CSV
node christmas-stock/upload/adobe-upload.cjs               # open the browser → log in → automatic upload
```
The script uploads the files and the CSV, then stops before **Submit**. Next time you won't need to log in again (the session is stored in `~/.adobe-stock-profile`).
