// ===================== SETUP =====================

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const modal = document.getElementById("modal");
const dropZone = document.getElementById("dropZone");

const layoutsContainer = document.getElementById("layouts");
const exportPanel = document.getElementById("exportPanel");
const previewList = document.getElementById("previewList");

const rowsInput = document.getElementById("rows");
const rowsValue = document.getElementById("rowsValue");

canvas.width = window.innerWidth - 288;
canvas.height = window.innerHeight - 257;

let image = null;

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

function loadImage(src) {
  const img = new Image();
  img.crossOrigin = "anonymous";

  img.onload = () => {
    image = img;
    updatePlaceholder();
    syncUIFromState();
    updateImageRect();
    draw(); // no reset
  };

  img.src = src;
}

function loadFile(file) {
  const r = new FileReader();
  r.onload = (e) => loadImage(e.target.result);
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

function hasFiles(e) {
  return e.dataTransfer && [...e.dataTransfer.types].includes("Files");
}

window.addEventListener("dragover", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
});

window.addEventListener("drop", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  loadFile(e.dataTransfer.files[0]);
  closeModal();
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
    sx: (r.x - getImageDisplayRect().x) / getImageDisplayRect().scale,
    sy: (r.y - getImageDisplayRect().y) / getImageDisplayRect().scale,
    sw: r.w / getImageDisplayRect().scale,
    sh: r.h / getImageDisplayRect().scale,
  }));
}

// ===================== DRAW =====================

function draw() {
  saveStateToURL();
  if (!image) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const img = getImageDisplayRect();

  ctx.globalAlpha = state.brightness;
  ctx.drawImage(image, img.x, img.y, img.w, img.h);

  ctx.globalAlpha = 1;

  getRects().forEach((r) => {
    ctx.drawImage(image, r.sx, r.sy, r.sw, r.sh, r.x, r.y, r.w, r.h);
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.strokeRect(r.x, r.y, r.w, r.h);
  });
}

// ===================== CONTROLS =====================

rowsInput.value = state.rows;
rowsValue.textContent = state.rows;

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
  state.scale = parseFloat(e.target.value) ?? 1;
  draw();
};

document.getElementById("brightness").oninput = (e) => {
  state.brightness = parseFloat(e.target.value) ?? 0.25;
  draw();
};

document.getElementById("shareBtn").onclick = async () => {
  try {
    saveStateToURL();
    await navigator.clipboard.writeText(location.href);

    const oldText = shareBtn.textContent;
    shareBtn.textContent = "Link copied ✓";

    setTimeout(() => {
      shareBtn.textContent = oldText;
    }, 1200);
  } catch (e) {
    alert("Copy failed");
  }
};

// ===================== LAYOUT SELECTORS =====================

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
    const c = document.createElement("canvas");
    c.width = r.sw;
    c.height = r.sh;

    const cctx = c.getContext("2d");
    cctx.drawImage(image, r.sx, r.sy, r.sw, r.sh, 0, 0, c.width, c.height);

    const url = c.toDataURL();

    const img = document.createElement("img");
    img.src = url;
    img.className = "w-40 h-auto rounded object-cover flex-shrink-0";

    const link = document.createElement("a");
    link.href = url;
    link.download = `nugget_${r.row}_${r.col}.png`;
    link.appendChild(img);

    previewList.appendChild(link);
  });
};

document.getElementById("downloadZip").onclick = async () => {
  if (!image) return;

  const zip = new JSZip();
  const rects = getRects();

  rects.forEach((r) => {
    const c = document.createElement("canvas");
    c.width = r.sw;
    c.height = r.sh;

    const cctx = c.getContext("2d");
    cctx.drawImage(image, r.sx, r.sy, r.sw, r.sh, 0, 0, c.width, c.height);

    const data = c.toDataURL("image/png").split(",")[1];

    zip.file(`nugget_${r.row}_${r.col}.png`, data, { base64: true });
  });

  const blob = await zip.generateAsync({ type: "blob" });

  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "nuggets.zip";
  a.click();
};
