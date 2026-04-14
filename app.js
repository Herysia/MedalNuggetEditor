import {
  encode,
  decode,
  decodeFrames,
} from "https://cdn.jsdelivr.net/npm/modern-gif/+esm";
import workerUrl from "https://cdn.jsdelivr.net/npm/modern-gif/+esm?url";

// ===================== SETUP =====================

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const modal = document.getElementById("modal");
const layoutsContainer = document.getElementById("layouts");
const previewList = document.getElementById("previewList");

const rowsInput = document.getElementById("rows");
const rowsValue = document.getElementById("rowsValue");

canvas.width = window.innerWidth - 288;
canvas.height = window.innerHeight - 257;

let image = null;
let isGIF = false;
let gifFrames = [];
let currentFrameIndex = 0;
let lastFrameTime = 0;
let gifPaused = false;
let animationFrame = null;
let gifReader = null;

let state = {
  rows: 3,
  layouts: ["Eyes", "Eyes", "Eyes"],
  scale: 0.5,
  offsetX: 0.5,
  offsetY: 0.5,
  brightness: 0.25,
};

const LAYOUTS = ["Eyes", "Pocket", "Bike Lane", "Bento", "Otneb"];
const BASE_REF_WIDTH = 1000;

// ===================== GIF ANIMATION =====================

function stopGIFAnimation() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
}

function startGIFAnimation() {
  stopGIFAnimation();
  if (!isGIF || gifFrames.length === 0 || gifPaused) return;

  const animate = (timestamp) => {
    if (!lastFrameTime) lastFrameTime = timestamp;

    const frame = gifFrames[currentFrameIndex];
    if (timestamp - lastFrameTime > frame.delay) {
      currentFrameIndex = (currentFrameIndex + 1) % gifFrames.length;
      lastFrameTime = timestamp;
      draw();
    }
    animationFrame = requestAnimationFrame(animate);
  };

  animationFrame = requestAnimationFrame(animate);
}

// ===================== GIF DECODING (Decoder part) =====================

async function loadAndDecodeGIF(src, filename = "") {
  stopGIFAnimation();

  gifFrames = [];
  currentFrameIndex = 0;
  isGIF = false;

  const lowerName = (filename || "").toLowerCase();
  const isGifFile =
    lowerName.endsWith(".gif") ||
    (typeof src === "string" && src.startsWith("data:image/gif"));

  if (!isGifFile) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        image = img;
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }

  isGIF = true;

  try {
    const buffer = await (await fetch(src)).arrayBuffer();

    const gif = decode(buffer);

    const width = gif.width;
    const height = gif.height;

    if (!width || !height) {
      throw new Error("Invalid GIF metadata");
    }

    const frames = await decodeFrames(buffer, { workerUrl });

    if (!frames?.length) {
      throw new Error("No frames decoded");
    }

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];

      const canvas = document.createElement("canvas");
      canvas.width = frame.width;
      canvas.height = frame.height;

      const ctx = canvas.getContext("2d");

      ctx.putImageData(
        new ImageData(
          frame.data,
          frame.width,
          frame.height
        ),
        0,
        0
      );

      gifFrames.push({
        data: canvas,
        delay: Math.max(frame.delay || 2, 1)
      });
    }

    image = gifFrames[0].data;

    console.log(
      `%cGIF decoded with modern-gif + worker (${frames.length} frames)`,
      "color: lime"
    );

    return true;
  } catch (err) {
    console.error("modern-gif decode failed:", err);

    isGIF = false;

    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        image = img;
        resolve(true);
      };
      img.onerror = () => resolve(false);
      img.src = src;
    });
  }
}

// ===================== ANIMATED GIF EXPORT =====================

async function createAnimatedGIF(cropRect) {
  if (!isGIF || gifFrames.length === 0) {
    console.warn("No GIF frames available");
    return null;
  }

  try {
    const w = Math.round(cropRect.sw);
    const h = Math.round(cropRect.sh);

    const frames = [];

    for (const frame of gifFrames) {
      const temp = document.createElement("canvas");
      temp.width = w;
      temp.height = h;

      const ctx = temp.getContext("2d");

      ctx.drawImage(
        frame.data,
        cropRect.sx,
        cropRect.sy,
        cropRect.sw,
        cropRect.sh,
        0,
        0,
        w,
        h
      );

      frames.push({
        data: temp,
        delay: Math.max(Math.round(frame.delay), 20)
      });
    }

    const output = await encode({
      workerUrl,
      width: w,
      height: h,
      frames
    });

    const blob = new Blob([output], { type: "image/gif" });

    return URL.createObjectURL(blob);

  } catch (err) {
    console.error("Failed to create animated GIF:", err);
    return null;
  }
}
// ===================== IMAGE DISPLAY =====================

let cachedImageRect = null;

function updateImageRect() {
  if (!image) return;

  const maxW = canvas.width * 0.99;
  const maxH = canvas.height * 0.99;

  const scale = Math.min(maxW / image.width, maxH / image.height);

  const w = image.width * scale;
  const h = image.height * scale;

  cachedImageRect = {
    x: (canvas.width - w) / 2,
    y: (canvas.height - h) / 2,
    w,
    h,
    scale,
  };
}

function getImageDisplayRect() {
  return cachedImageRect;
}

window.addEventListener("resize", () => {
  canvas.width = window.innerWidth - 288;
  canvas.height = window.innerHeight - 257;
  updateImageRect();
  draw();
});

// ===================== URL STATE =====================

let urlTimer = null;

function queueSaveStateToURL() {
  clearTimeout(urlTimer);

  urlTimer = setTimeout(saveStateToURL, 1000); // small delay after interaction stops
}

function saveStateToURL() {
  const p = new URLSearchParams();

  p.set("r", state.rows);
  p.set("s", state.scale.toFixed(2));
  p.set("x", state.offsetX.toFixed(3));
  p.set("y", state.offsetY.toFixed(3));
  p.set("b", state.brightness.toFixed(2));
  p.set("l", state.layouts.slice(0, state.rows).join(","));

  const newUrl = "?" + p.toString();

  if (location.search !== newUrl) {
    history.replaceState(null, "", newUrl);
  }
}

function loadStateFromURL() {
  const p = new URLSearchParams(location.search);

  if (p.has("r")) state.rows = +p.get("r");
  if (p.has("s")) state.scale = +p.get("s");
  if (p.has("x")) state.offsetX = +p.get("x");
  if (p.has("y")) state.offsetY = +p.get("y");
  if (p.has("b")) state.brightness = +p.get("b");
  if (p.has("l")) state.layouts = p.get("l").split(",");

  while (state.layouts.length < state.rows) state.layouts.push("Eyes");
}

function syncUIFromState() {
  // sliders
  const scaleInput = document.getElementById("scale");
  const brightnessInput = document.getElementById("brightness");

  if (scaleInput) scaleInput.value = state.scale;
  if (brightnessInput) brightnessInput.value = state.brightness;

  // rows slider
  if (rowsInput) {
    rowsInput.value = state.rows;
    rowsValue.textContent = state.rows;
  }

  // layout selectors
  renderLayoutSelectors();
}

loadStateFromURL();
syncUIFromState();

// ===================== IMAGE LOADING =====================

async function loadImage(src, filename = "") {
  stopGIFAnimation();
  const success = await loadAndDecodeGIF(src, filename);
  if (!success) return;

  updatePlaceholder();
  syncUIFromState();
  updateImageRect();

  if (isGIF && gifFrames.length > 0) {
    currentFrameIndex = 0;
    lastFrameTime = 0;
    startGIFAnimation();
  } else {
    draw();
  }
}

function loadFile(file) {
  const r = new FileReader();
  r.onload = (e) => loadImage(e.target.result, file.name);
  r.readAsDataURL(file);
}

// ===================== MODAL =====================
function closeModal() {
  modal.classList.add("hidden");
}

document.getElementById("loadBtn").onclick = () =>
  modal.classList.remove("hidden");

document.getElementById("dropPlaceholder").onclick = () =>
  modal.classList.remove("hidden");

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

modal.onclick = (e) => {
  if (e.target === modal) closeModal();
};

// ===================== INPUT =====================

document.getElementById("fileInput").onchange = (e) => {
  if (e.target.files[0]) {
    loadFile(e.target.files[0]);
    closeModal();
  }
};

document.getElementById("urlInput").onkeydown = (e) => {
  if (e.key === "Enter") {
    loadImage(e.target.value);
    closeModal();
  }
};

// ===================== DRAG & DROP =====================

window.addEventListener("dragover", (e) => {
  if (e.dataTransfer.types.includes("Files")) e.preventDefault();
});
window.addEventListener("drop", (e) => {
  if (e.dataTransfer.files[0]) {
    e.preventDefault();
    loadFile(e.dataTransfer.files[0]);
    closeModal();
  }
});

function updatePlaceholder() {
  const placeholder = document.getElementById("dropPlaceholder");

  if (!image) {
    placeholder.style.display = "flex";
  } else {
    placeholder.style.display = "none";
  }
}

// ===================== GRID =====================

function rect(x, y, w, h) {
  return { x, y, w, h };
}

function rowRects(x, y, widths, h, gap) {
  let cx = x;
  return widths.map((w) => {
    const r = rect(cx, y, w, h);
    cx += w + gap;
    return r;
  });
}

function getRects() {
  if (!image) return [];

  const img = getImageDisplayRect();

  const scaleFactor = (img.w / BASE_REF_WIDTH) * state.scale;
  const baseH = 195 * scaleFactor;
  const wideW = (baseH * 500) / 296;
  const narrowW = (baseH * 238) / 296;
  const smallH = (baseH * 140) / 296;
  const gap = 16 * scaleFactor;

  let rects = [];
  const gridWidth = 846 * scaleFactor; // or dynamic per layout
  const gridHeight = state.rows * (baseH + gap);

  for (let row = 0; row < state.rows; row++) {
    const layout = state.layouts[row];
    const x = img.x + img.w * state.offsetX - gridWidth / 2;

    const y =
      img.y + img.h * state.offsetY - gridHeight / 2 + row * (baseH + gap);

    let cx = x;

    if (layout === "Eyes") {
      rowRects(x, y, [wideW, narrowW, wideW], baseH, gap).forEach((r, col) =>
        rects.push({ ...r, row, col }),
      );
    } else if (layout === "Pocket") {
      rowRects(x, y, [wideW, wideW, narrowW], baseH, gap).forEach((r, col) =>
        rects.push({ ...r, row, col }),
      );
    } else if (layout === "Bike Lane") {
      let col = 0;

      rects.push({ ...rect(cx, y, narrowW, baseH), row, col: col++ });
      cx += narrowW + gap;

      rects.push({ ...rect(cx, y, wideW, baseH), row, col: col++ });
      cx += wideW + gap;

      rects.push({ ...rect(cx, y, narrowW, baseH), row, col: col++ });
      cx += narrowW + gap;

      rects.push({ ...rect(cx, y, narrowW, smallH), row, col: col++ });
      rects.push({
        ...rect(cx, y + smallH + gap, narrowW, baseH - smallH - gap),
        row,
        col: col++,
      });
    } else if (layout === "Bento") {
      let bx = x + wideW + gap;

      rects.push({ ...rect(x, y, wideW, baseH), row, col: 0 });
      rects.push({ ...rect(bx, y, wideW, smallH), row, col: 1 });
      rects.push({
        ...rect(bx, y + smallH + gap, narrowW, baseH - smallH - gap),
        row,
        col: 2,
      });
      rects.push({
        ...rect(
          bx + narrowW + gap,
          y + smallH + gap,
          narrowW,
          baseH - smallH - gap,
        ),
        row,
        col: 3,
      });
      rects.push({ ...rect(bx + wideW + gap, y, narrowW, baseH), row, col: 4 });
    } else if (layout === "Otneb") {
      let bx = x + narrowW + gap;

      rects.push({ ...rect(x, y, narrowW, baseH), row, col: 0 });
      rects.push({ ...rect(bx, y, wideW, smallH), row, col: 1 });
      rects.push({
        ...rect(bx, y + smallH + gap, narrowW, baseH - smallH - gap),
        row,
        col: 2,
      });
      rects.push({
        ...rect(
          bx + narrowW + gap,
          y + smallH + gap,
          narrowW,
          baseH - smallH - gap,
        ),
        row,
        col: 3,
      });
      rects.push({ ...rect(bx + wideW + gap, y, wideW, baseH), row, col: 4 });
    }
  }

  return rects.map((r) => ({
    ...r,
    sx: (r.x - img.x) / img.scale,
    sy: (r.y - img.y) / img.scale,
    sw: r.w / img.scale,
    sh: r.h / img.scale,
  }));
}

// ===================== DRAW =====================

function draw() {
  queueSaveStateToURL();
  if (!image) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const img = getImageDisplayRect();

  ctx.globalAlpha = state.brightness;

  if (isGIF && gifFrames.length > 0) {
    const frame = gifFrames[currentFrameIndex];
    ctx.drawImage(frame.data, img.x, img.y, img.w, img.h);
  } else {
    ctx.drawImage(image, img.x, img.y, img.w, img.h);
  }

  ctx.globalAlpha = 1;

  getRects().forEach((r) => {
    if (isGIF && gifFrames.length > 0) {
      const frame = gifFrames[currentFrameIndex];
      ctx.drawImage(frame.data, r.sx, r.sy, r.sw, r.sh, r.x, r.y, r.w, r.h);
    } else {
      ctx.drawImage(image, r.sx, r.sy, r.sw, r.sh, r.x, r.y, r.w, r.h);
    }
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  });
}

// ===================== CONTROLS =====================

rowsInput.oninput = (e) => {
  state.rows = +e.target.value;
  rowsValue.textContent = state.rows;

  while (state.layouts.length < state.rows) state.layouts.push("Eyes");

  renderLayoutSelectors();
  draw();
};

document.getElementById("centerH").onclick = () => {
  state.offsetX = 0.5;
  draw();
};

document.getElementById("centerV").onclick = () => {
  state.offsetY = 0.5;
  draw();
};

document.getElementById("resetBtn").onclick = () => {
  state.scale = 0.5;
  state.offsetX = 0.5;
  state.offsetY = 0.5;
  syncUIFromState();
  draw();
};

document.getElementById("scale").oninput = (e) => {
  state.scale = +e.target.value;
  draw();
};

document.getElementById("brightness").oninput = (e) => {
  state.brightness = +e.target.value;
  draw();
};

document.getElementById("shareBtn").onclick = async () => {
  saveStateToURL();
  await navigator.clipboard.writeText(location.href);
  const btn = document.getElementById("shareBtn");
  const old = btn.textContent;
  btn.textContent = "Link copied ✓";
  setTimeout(() => (btn.textContent = old), 1200);
};

// Pause/Play GIF
let pauseBtn = document.getElementById("pauseGifBtn");
if (!pauseBtn) {
  pauseBtn = document.createElement("button");
  pauseBtn.id = "pauseGifBtn";
  pauseBtn.textContent = "Pause GIF";
  pauseBtn.style.marginLeft = "12px";
  const ctrl =
    document.getElementById("controls") ||
    document.querySelector(".controls") ||
    document.body;
  ctrl.appendChild(pauseBtn);
}
pauseBtn.onclick = () => {
  gifPaused = !gifPaused;
  pauseBtn.textContent = gifPaused ? "Play GIF" : "Pause GIF";
  if (gifPaused) stopGIFAnimation();
  else startGIFAnimation();
};

function renderLayoutSelectors() {
  layoutsContainer.innerHTML = "";

  for (let i = 0; i < state.rows; i++) {
    const select = document.createElement("select");
    select.className = "bg-zinc-800 p-2 rounded";

    LAYOUTS.forEach((l) => {
      const opt = document.createElement("option");
      opt.value = l;
      opt.textContent = l;
      if (state.layouts[i] === l) opt.selected = true;
      select.appendChild(opt);
    });

    select.onchange = (e) => {
      state.layouts[i] = e.target.value;
      draw();
    };

    layoutsContainer.appendChild(select);
  }
}

renderLayoutSelectors();

// ===================== DRAG =====================

let dragging = false,
  lx = 0,
  ly = 0;

canvas.onmousedown = (e) => {
  dragging = true;
  lx = e.clientX;
  ly = e.clientY;
};

canvas.onmousemove = (e) => {
  if (!dragging || !image) return;
  const img = getImageDisplayRect();

  state.offsetX += (e.clientX - lx) / img.w;
  state.offsetY += (e.clientY - ly) / img.h;

  lx = e.clientX;
  ly = e.clientY;

  draw();
};

canvas.onmouseup = () => (dragging = false);

// ===================== EXPORT =====================

document.getElementById("generate").onclick = () => {
  if (!image) return;

  previewList.innerHTML = "";

  getRects().forEach((r) => {
    const container = document.createElement("div");
    container.style.margin = "8px";
    container.style.display = "inline-block";

    if (isGIF && gifFrames.length > 0) {
      const previewImg = document.createElement("img");
      previewImg.style.maxWidth = "160px";
      previewImg.style.borderRadius = "6px";

      createAnimatedGIF(r).then((url) => {
        if (url) previewImg.src = url;
      });

      const link = document.createElement("a");
      link.download = `nugget_${r.row}_${r.col}.gif`;
      link.appendChild(previewImg);
      container.appendChild(link);
    } else {
      const c = document.createElement("canvas");
      c.width = r.sw;
      c.height = r.sh;

      const cctx = c.getContext("2d");
      cctx.drawImage(image, r.sx, r.sy, r.sw, r.sh, 0, 0, c.width, c.height);

      const imgEl = document.createElement("img");
      imgEl.src = c.toDataURL();
      imgEl.className = "w-40 h-auto rounded";

      const link = document.createElement("a");
      link.href = c.toDataURL();
      link.download = `nugget_${r.row}_${r.col}.png`;
      link.appendChild(imgEl);
      container.appendChild(link);
    }
    previewList.appendChild(container);
  });
};

document.getElementById("downloadZip").onclick = async () => {
  if (!image) return;

  const zip = new JSZip();

  getRects().forEach(async (r) => {
    if (isGIF && gifFrames.length > 0) {
      const gifUrl = await createAnimatedGIF(r);
      if (gifUrl) {
        const blob = await fetch(gifUrl).then((res) => res.blob());
        zip.file(`nugget_${r.row}_${r.col}.gif`, blob);
      }
    } else {
      const c = document.createElement("canvas");
      c.width = r.sw;
      c.height = r.sh;

      const cctx = c.getContext("2d");
      cctx.drawImage(image, r.sx, r.sy, r.sw, r.sh, 0, 0, c.width, c.height);

      const data = c.toDataURL("image/png").split(",")[1];

      zip.file(`nugget_${r.row}_${r.col}.png`, data, { base64: true });
    }
  });

  const blob = await zip.generateAsync({ type: "blob" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = isGIF ? "nuggets_animated.zip" : "nuggets.zip";
  a.click();
};
