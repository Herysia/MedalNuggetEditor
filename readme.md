# MedalNuggetEditor

A browser-based tool to slice images into structured grid layouts (“nuggets”) designed for Medal-style profile customization.

You can load an image, overlay customizable grid layouts, adjust positioning, scaling, and export each section as individual images.

Perfect for creating aesthetic profile tiles and structured image sets.

## 🔗 Live Demo

👉 Try it here: https://herysia.github.io/MedalNuggetEditor/

---

## ✨ Features

- 🖼 Load images **and GIFs** (drag & drop, file picker, URL)
- 🎞 GIF support
- 📐 Multiple grid layouts:
  - Eyes
  - Pocket
  - Bike Lane
  - Bento
  - Otneb
- 🎛 Adjustable controls:
  - Grid scale
  - Brightness
  - Number of rows (1–10)
  - Per-row layout selection
- 🧭 Drag to reposition grid
- 🎯 Center horizontally / vertically
- 🔗 Shareable state via URL
- 📦 Export system:
  - Preview all generated nuggets
  - Download individually or as ZIP
- 🌙 Modern responsive UI
- 💾 No backend - runs fully in the browser

---

## 🚀 How It Works

1. Load an image
2. Choose number of rows
3. Select layout types per row
4. Adjust scale, and position. Brightness help you to preview.
5. Preview generated nuggets
6. Export images or download ZIP

Each output image is named:
`nugget_row_column.png`
Example:

```
nugget_0_0.png
nugget_0_1.png
nugget_1_2.png
```

You can just import them in your Medal.tv profile, one by one.

---

## 🔗 Shareable State

The full editor state is encoded in the URL, allowing you to:

- Copy a link
- Reopen exact same layout
- Share configurations
- Reopen your configuration later, for example if you edited the input image and just want a single nugget

---

## 🛠 Running Locally

⚠️ It won't work properly if you open the project directly via `file://` due to CORS restrictions.

👉 You **must run a local server**.

### Quick options:

- Using Python:
```
python -m http.server
```
- Using Node:
```
npx serve
```

Then open:
http://localhost:8000  
(or the port shown in your terminal)

---

## 📦 Tech Stack

- Vanilla JavaScript
- HTML5 Canvas
- TailwindCSS
- JSZip (for ZIP export)
- FileReader / Drag & Drop APIs

---

## 📸 Preview

https://github.com/user-attachments/assets/9ca8b566-dfac-432a-8937-3c1d0b4dbcda

---

## 📄 License

MIT — feel free to use, modify, and share.
