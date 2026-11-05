# Bundled font provenance

These files locally host the same Google Fonts families/weights requested by the source site's CSS. They remove a runtime dependency on Google Fonts without changing the downloaded font bytes. `static/css/fonts.css` points to these local files.

| Local files | Family | Normal-style weights |
| --- | --- | --- |
| `font-0.ttf` through `font-4.ttf` | Outfit | 400, 500, 600, 700, 800 |
| `font-5.ttf` through `font-8.ttf` | Plus Jakarta Sans | 400, 500, 600, 700 |

The exact upstream CSS request was [Google Fonts CSS for Outfit and Plus Jakarta Sans](https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap), requested with `User-Agent: Mozilla/5.0`. Only the CSS font URLs were replaced with local paths. Font files were downloaded unchanged.

Both families are distributed under the **SIL Open Font License 1.1**. The full family-specific copyright and license files are included alongside the font files:

- Outfit: [local license](outfit-OFL.txt); [official google/fonts license source](https://github.com/google/fonts/blob/main/ofl/outfit/OFL.txt). Copyright 2021 The Outfit Project Authors.
- Plus Jakarta Sans: [local license](plusjakartasans-OFL.txt); [official google/fonts license source](https://github.com/google/fonts/blob/main/ofl/plusjakartasans/OFL.txt). Copyright 2020 The Plus Jakarta Sans Project Authors.

Both local license files were byte-verified against their official `google/fonts` raw files on **2026-11-05**. Keep these notices and licenses with redistributed font copies.
