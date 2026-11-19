# 1D model of the return spring + advection exactly as in renderLoop (lines 716-766):
#   v' = v + k*(ox - x)        k = COEF * dt   (full smooth)
#   x  = x + v'
#   v  = 0.4 * v'
# Eigen-analysis: A = [[1-k, 1], [-0.4k, 0.4]], det = 0.4, trace = 1.4 - k
import cmath
COEF = 93.75
for fps_dt in [1/144, 1/120, 1/60, 0.025, 0.030, 1/30, 0.04, 0.05]:
    k = COEF * fps_dt
    tr = 1.4 - k
    disc = cmath.sqrt(tr * tr - 1.6)
    l1, l2 = (tr + disc) / 2, (tr - disc) / 2
    r = max(abs(l1), abs(l2))
    # simulate 1px initial error
    x, v = 1.0, 0.0
    traj = []
    for _ in range(8):
        vp = v - k * x
        x += vp
        v = 0.4 * vp
        traj.append(round(x, 3))
    print(f"dt={fps_dt*1000:5.1f}ms k={k:5.2f} |lambda|max={r:5.3f} {'UNSTABLE' if r>1 else ''} err: {traj}")
print("stability limit dt =", round(2.8 / COEF * 1000, 2), "ms  (k=2.8)")
