import { ArrowRight, Eye, MousePointerClick, Scan, X } from "lucide-react";
import Button from "../components/ui/Button";
import useCalibration, { CALIBRATION_POINTS } from "../hooks/useCalibration";

// Visual inset from the true viewport edge so corner dots stay comfortably
// on-screen and clickable-looking, while the calibration target coordinates
// they represent stay exactly 0/1 (see useCalibration) — the same margin
// convention a real screen-edge gaze calibration would use.
const EDGE_INSET = 6; // vw / vh

function dotStyle(point) {
  const x = point.x === 0 ? EDGE_INSET : point.x === 1 ? 100 - EDGE_INSET : point.x * 100;
  const y = point.y === 0 ? EDGE_INSET : point.y === 1 ? 100 - EDGE_INSET : point.y * 100;
  return { top: `${y}vh`, left: `${x}vw` };
}

export default function CalibrationScreen({ videoRef, videoRefCallback, onCalibrated, onExit }) {
  const { start, confirmCurrentPoint, pointIndex, capturing, done, mapper, captureError, activePoint } =
    useCalibration(videoRef);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-ink-950">
      <div className="ambient-glow" />
      <div className="bg-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_center,black,transparent_75%)]" />

      {/* Fixed top-center, deliberately: dots only ever occupy the 4 corners or dead-center,
          never top-center, so Exit can never coincide with one. */}
      <button
        onClick={onExit}
        className="fixed left-1/2 top-4 z-30 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-ink-600 bg-ink-900/70 px-3 py-1.5 text-xs font-medium text-mist-400 backdrop-blur transition-colors hover:border-mock-500/50 hover:text-mock-500"
      >
        <X size={13} />
        Exit
      </button>

      {/* Dots sit at z-20 — deliberately ABOVE the instructional panel and self-view video,
          both of which visually reach toward the center/corners too. Without this, the
          dead-center dot would render underneath the centered instructional text (later in
          the DOM = painted on top), swallowing every click and landing on the text instead —
          which is exactly what "clicking selects nearby text" was. */}
      {CALIBRATION_POINTS.map((point, i) => {
        const isActive = pointIndex === i;
        const isDone = done || i < pointIndex;
        return isActive ? (
          <button
            key={point.key}
            onClick={confirmCurrentPoint}
            disabled={capturing}
            aria-label={`Confirm looking at ${point.key.replace("-", " ")}`}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-pointer select-none disabled:cursor-wait"
            style={dotStyle(point)}
          >
            <span className="absolute inset-0 -m-3 animate-ping rounded-full bg-brand-400/40" />
            <span
              className={`relative block h-8 w-8 rounded-full border-2 border-brand-300 bg-brand-400 shadow-[0_0_28px_4px_rgba(109,91,255,0.7)] transition-transform ${
                capturing ? "scale-90" : "scale-100 hover:scale-110"
              }`}
            />
          </button>
        ) : (
          <span key={point.key} className="absolute z-20 -translate-x-1/2 -translate-y-1/2" style={dotStyle(point)}>
            <span
              className={`block h-6 w-6 rounded-full border-2 transition-all duration-300 ${
                isDone
                  ? "border-practice-500 bg-practice-500/60 shadow-[0_0_12px_0_rgba(34,211,184,0.5)]"
                  : "border-ink-500 bg-ink-700"
              }`}
            />
          </span>
        );
      })}

      {/* Anchored to the bottom third, not dead-center — the true center of the screen is
          reserved for the center calibration dot and must stay completely free. */}
      <div className="fixed inset-x-0 bottom-10 z-10 flex flex-col items-center gap-5 px-6 text-center">
        <div className="animate-rise-in flex flex-col items-center gap-3">
          <span className="glass-panel flex h-12 w-12 items-center justify-center rounded-2xl text-brand-300">
            <Scan size={22} strokeWidth={1.75} />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-white text-balance sm:text-3xl">
              Calibrate eye &amp; face tracking
            </h1>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-mist-400 text-balance">
              Look directly at the highlighted dot, then click it to confirm — one click per corner, plus the
              center.
            </p>
          </div>
        </div>

        {pointIndex === -1 && !done && (
          <Button variant="primary" onClick={start} className="animate-rise-in">
            <Eye size={16} />
            Start calibration
          </Button>
        )}

        {activePoint && (
          <p className="animate-rise-in flex items-center gap-2 rounded-full border border-ink-600 bg-ink-900/70 px-5 py-2 text-sm text-mist-300 backdrop-blur">
            <MousePointerClick size={15} className="text-brand-300" />
            {capturing ? (
              "Capturing…"
            ) : (
              <>
                Look at the <span className="font-semibold text-white">{activePoint.key.replace("-", " ")}</span>{" "}
                dot, then click it
              </>
            )}
          </p>
        )}

        {captureError && (
          <div className="glass-panel animate-rise-in max-w-md px-5 py-4 text-sm text-mock-500">
            {captureError}
            <div className="mt-3">
              <Button variant="ghost" onClick={confirmCurrentPoint}>
                Retry
              </Button>
            </div>
          </div>
        )}

        {done && (
          <div className="animate-rise-in flex flex-col items-center gap-4">
            <p className="flex items-center gap-2 text-lg font-semibold text-practice-500">
              <span className="h-2 w-2 rounded-full bg-practice-500" />
              Calibration complete
            </p>
            <Button variant="primary" onClick={() => onCalibrated(mapper)}>
              Start the interview
              <ArrowRight size={16} />
            </Button>
          </div>
        )}
      </div>

      {/* Small self-view so the candidate can check framing/lighting. Pulled in further than
          a literal corner (and kept below the dots' z-20) so it never competes with the
          bottom-right dot for clicks, even though their footprints can still visually graze. */}
      <div className="glass-panel fixed bottom-10 right-10 z-10 h-28 w-40 overflow-hidden !rounded-xl">
        <video
          ref={videoRefCallback}
          autoPlay
          muted
          playsInline
          className="h-full w-full scale-x-[-1] object-cover"
        />
      </div>
    </div>
  );
}
