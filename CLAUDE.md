# Project memory: Dalops

## Adobe Stock (Christmas 2026 stock images)
- The `christmas-stock/` folder holds 20 original Christmas illustrations generated from code (**not generative AI**). Always answer **No** to Adobe's AI question.
- Ready-to-upload batch: `christmas-stock/vector/upload/`: 19 EPS (Vectors) + `christmas_10_gold_bokeh.jpg` (Illustrations, because blur is not allowed in vectors) + `adobe_stock_metadata_upload.csv`.
- Upload: use the skill **`/adobe-stock-upload`** (`.claude/skills/adobe-stock-upload/SKILL.md`). The user logs in **by hand** in the browser. Claude never handles the password and never clicks Submit.
- Upload only one format per design (EPS *or* JPG). Uploading both gets rejected as similar content.
- Adobe EPS requirements met by `vectorize.py`: no transparency, no blur/filters, no raster, text converted to outlines, artboard ≥ 24 MP.
- Metadata: English titles, ≤ 49 keywords (most important first), Category codes: 3 Business, 7 Food, 8 Graphic Resources, 15 Culture and Religion.
- Upload status: **not uploaded yet** (as of 21 Nov 2026). Update this line after submitting.
