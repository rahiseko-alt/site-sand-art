from playwright.sync_api import sync_playwright
import time, sys

# Usage: python jitter_diag.py [block_ms]
# block_ms: extra busy-wait per frame to simulate slow frames (0 = none)
BLOCK_MS = float(sys.argv[1]) if len(sys.argv) > 1 else 0

SAMPLE_JS = """(blockMs) => new Promise(resolve => {
  const N = 3000;
  const stride = Math.max(1, Math.floor(au.length / N));
  const idx = [];
  for (let i = 0; i < au.length; i += stride) idx.push(i);
  let prev = idx.map(i => [au[i].x, au[i].y]);
  let last = performance.now();
  const frames = [];
  const start = last;
  function tick() {
    if (blockMs > 0) { const s = performance.now(); while (performance.now() - s < blockMs) {} }
    const now = performance.now();
    let sum = 0, max = 0, moving = 0, notRet = 0, sumErr = 0;
    idx.forEach((i, k) => {
      const a = au[i];
      const d = Math.hypot(a.x - prev[k][0], a.y - prev[k][1]);
      sum += d; if (d > max) max = d; if (d > 0.3) moving++;
      if (a.returnStartAt === null) notRet++;
      sumErr += Math.hypot(a.x - a.ox, a.y - a.oy);
      prev[k][0] = a.x; prev[k][1] = a.y;
    });
    frames.push({dt: +(now - last).toFixed(1), avgMove: +(sum/idx.length).toFixed(3),
                 maxMove: +max.toFixed(2), movingPct: +(100*moving/idx.length).toFixed(1),
                 notRetPct: +(100*notRet/idx.length).toFixed(1), avgErr: +(sumErr/idx.length).toFixed(3)});
    last = now;
    if (now - start < 3000) requestAnimationFrame(tick); else resolve(frames);
  }
  requestAnimationFrame(tick);
})"""

with sync_playwright() as p:
    browser = p.chromium.launch(
        executable_path=r"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
        headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 800})
    page.goto("http://127.0.0.1:4000/demo.html", wait_until="networkidle")
    time.sleep(0.8)
    page.mouse.move(400, 400)
    for x in range(400, 750, 25):
        page.mouse.move(x, 400 + (x % 40) - 20)
        time.sleep(0.02)
    page.mouse.move(1279, 799)
    time.sleep(10)  # wait until converged
    frames = page.evaluate(SAMPLE_JS, BLOCK_MS)
    dts = sorted(f["dt"] for f in frames)
    print(f"BLOCK_MS={BLOCK_MS} frames={len(frames)} dt median={dts[len(dts)//2]} max={dts[-1]}")
    big = [f for f in frames if f["dt"] > 29.9]
    print(f"frames with dt>29.9ms: {len(big)}")
    avg = sum(f['avgMove'] for f in frames)/len(frames)
    print(f"mean avgMove/frame={avg:.3f}px  max maxMove={max(f['maxMove'] for f in frames)}  "
          f"mean movingPct={sum(f['movingPct'] for f in frames)/len(frames):.1f}%  "
          f"mean notRetPct={sum(f['notRetPct'] for f in frames)/len(frames):.1f}%  "
          f"last avgErr={frames[-1]['avgErr']}")
    for f in frames[:8]:
        print(f)
    browser.close()
