// Use the rendered globe's alpha, rather than guessing its position or changing
// whole words. Only the small heading region is sampled, at CSS-pixel resolution.
export function attachHeadingMask(map, heading) {
  if (!heading) return () => {};
  const sample = document.createElement("canvas");
  const context = sample.getContext("2d", {willReadFrequently: true});
  if (!context) return () => {};
  let dirty = true;

  function invalidate() {
    dirty = true;
    map.triggerRepaint();
  }

  function update() {
    if (!dirty) return;
    dirty = false;
    const canvas = map.getCanvas();
    const globe = canvas.getBoundingClientRect();
    const text = heading.getBoundingClientRect();
    const left = Math.max(text.left, globe.left), top = Math.max(text.top, globe.top);
    const right = Math.min(text.right, globe.right), bottom = Math.min(text.bottom, globe.bottom);
    if (right <= left || bottom <= top || document.fullscreenElement) {
      clearMask();
      return;
    }
    const width = Math.ceil(text.width), height = Math.ceil(text.height);
    if (sample.width !== width) sample.width = width;
    if (sample.height !== height) sample.height = height;
    try {
      context.clearRect(0, 0, width, height);
      context.drawImage(canvas,
        (left - globe.left) * canvas.width / globe.width,
        (top - globe.top) * canvas.height / globe.height,
        (right - left) * canvas.width / globe.width,
        (bottom - top) * canvas.height / globe.height,
        left - text.left, top - text.top, right - left, bottom - top);
      const pixels = context.getImageData(0, 0, width, height).data;
      const leftEdge = [], rightEdge = [];
      // The globe's opaque silhouette has one continuous span per scanline.
      // Keep the soft atmospheric halo outside the text cutout.
      for (let y = 0; y < height; y++) {
        const row = y * width * 4;
        let first = 0, last = width - 1;
        while (first < width && pixels[row + first * 4 + 3] < 250) first++;
        if (first === width) continue;
        while (last > first && pixels[row + last * 4 + 3] < 250) last--;
        // Interpolate the contour between samples instead of snapping whole pixels.
        const before = first ? pixels[row + (first - 1) * 4 + 3] : 0;
        const after = last + 1 < width ? pixels[row + (last + 1) * 4 + 3] : 0;
        const x1 = first ? first - 0.5 + (250 - before) / (pixels[row + first * 4 + 3] - before) : 0;
        const x2 = last + 1 < width ? last + 0.5 + (pixels[row + last * 4 + 3] - 250) / (pixels[row + last * 4 + 3] - after) : width;
        leftEdge.push(`${x1.toFixed(2)} ${y + 0.5}`);
        rightEdge.push(`${x2.toFixed(2)} ${y + 0.5}`);
      }
      if (!leftEdge.length) {
        clearMask();
        return;
      }
      const outline = [...leftEdge, ...rightEdge.reverse()].join("L");
      // An inline vector cutout avoids asynchronous mask-image decoding, which
      // could hide/reveal the entire heading between animation frames.
      const clip = `path(evenodd, "M0 0H${width}V${height}H0ZM${outline}Z")`;
      if (heading.style.clipPath !== clip) heading.style.clipPath = clip;
    } catch {
      // Keep the original readable black text if canvas readback is unavailable.
      clearMask();
    }
  }

  function clearMask() {
    heading.style.removeProperty("clip-path");
  }

  map.on("move", invalidate);
  map.on("moveend", invalidate);
  map.on("resize", invalidate);
  map.on("render", update);
  const observer = new ResizeObserver(invalidate);
  observer.observe(heading);
  invalidate();
  return () => {
    observer.disconnect();
    map.off("move", invalidate);
    map.off("moveend", invalidate);
    map.off("resize", invalidate);
    map.off("render", update);
    clearMask();
  };
}
