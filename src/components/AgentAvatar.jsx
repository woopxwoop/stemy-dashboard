import { useRef, useState, useCallback, useEffect } from "react";

/* ── Keyframe animations injected once ──────────────────────────────────── */
const STYLES = `
  @keyframes aa-blink {
    0%, 88%, 100% { transform: scaleY(1); }
    92%            { transform: scaleY(0.08); }
  }
  @keyframes aa-scan {
    0%   { transform: translateX(-2px); }
    100% { transform: translateX(2px); }
  }
  @keyframes aa-pulse-glow {
    0%, 100% { opacity: 0.55; transform: scale(1); }
    50%       { opacity: 0;    transform: scale(1.45); }
  }
  @keyframes aa-float {
    0%, 100% { transform: translateY(0px); }
    50%       { transform: translateY(-4px); }
  }
  @keyframes aa-spin-dot {
    0%   { transform: rotate(0deg)   translateX(7px); }
    100% { transform: rotate(360deg) translateX(7px); }
  }
  @keyframes aa-tooltip-in {
    from { opacity: 0; transform: translateX(-50%) translateY(6px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes aa-antenna-bob {
    0%, 100% { transform: translateY(0); }
    50%       { transform: translateY(-2px); }
  }
`;

function useInjectStyles() {
  useEffect(() => {
    if (document.getElementById("agent-avatar-styles")) return;
    const el = document.createElement("style");
    el.id = "agent-avatar-styles";
    el.textContent = STYLES;
    document.head.appendChild(el);
  }, []);
}

/* ── App color tokens (mirrors App.css :root) ───────────────────────────── */
const C = {
  navy: "#0f2b5b",
  navyMid: "#1a3a6e", // slightly lighter navy for gradients
  blue: "#1e56e0",
  blueLight: "#dde8ff",
  red: "#e02b2b",
  redLight: "#fde8e8",
  border: "#cdd6e8",
  textMuted: "#7a8fad",
  textMid: "#3d5278",
};

/* ── Per-state config ───────────────────────────────────────────────────── */
const STATE = {
  idle: {
    label: "Standby",
    bg: `linear-gradient(145deg, ${C.navyMid}, ${C.navy})`,
    border: C.blue,
    glow: "rgba(30,86,224,0.35)",
    eyeAnim: "aa-blink 4s ease-in-out infinite",
    eyeColor: C.blueLight,
    pupilColor: C.navy,
    blush: "rgba(221,232,255,0.35)",
    mouthType: "smile",
    pulseColor: null,
  },
  thinking: {
    label: "Thinking…",
    bg: `linear-gradient(145deg, ${C.blue}, ${C.navyMid})`,
    border: C.blueLight,
    glow: "rgba(30,86,224,0.5)",
    eyeAnim: "aa-scan 0.9s ease-in-out infinite alternate",
    eyeColor: "#fff",
    pupilColor: C.navy,
    blush: "rgba(221,232,255,0.3)",
    mouthType: "hmm",
    pulseColor: null,
  },
  active: {
    label: "Running",
    bg: `linear-gradient(145deg, ${C.blue}, ${C.navy})`,
    border: C.blueLight,
    glow: "rgba(30,86,224,0.6)",
    eyeAnim: "none",
    eyeColor: "#fff",
    pupilColor: C.navy,
    blush: "rgba(221,232,255,0.45)",
    mouthType: "big-smile",
    pulseColor: C.blue,
  },
  alert: {
    label: "Alert!",
    bg: `linear-gradient(145deg, ${C.red}, #b01f1f)`,
    border: C.redLight,
    glow: "rgba(224,43,43,0.5)",
    eyeAnim: "aa-blink 0.6s ease-in-out infinite",
    eyeColor: C.redLight,
    pupilColor: "#5a0a0a",
    blush: "rgba(253,232,232,0.45)",
    mouthType: "worried",
    pulseColor: null,
  },
};

/* ── SVG face ───────────────────────────────────────────────────────────── */
function RobotFace({ state: stateKey, dragging }) {
  const s = STATE[stateKey];
  const eyeStyle = {
    transformOrigin: "center",
    animation: dragging ? "none" : s.eyeAnim,
  };

  return (
    <svg
      width="52"
      height="52"
      viewBox="0 0 52 52"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        display: "block",
        filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.18))",
      }}
    >
      {/* ── Antenna ── */}
      <g style={{ animation: "aa-antenna-bob 2.2s ease-in-out infinite" }}>
        <rect
          x="24.5"
          y="1"
          width="3"
          height="8"
          rx="1.5"
          fill="rgba(255,255,255,0.6)"
        />
        <circle cx="26" cy="1.5" r="3" fill="rgba(255,255,255,0.9)" />
      </g>

      {/* ── Head ── */}
      <rect
        x="7"
        y="10"
        width="38"
        height="30"
        rx="10"
        fill="rgba(255,255,255,0.18)"
      />
      <rect
        x="7"
        y="10"
        width="38"
        height="30"
        rx="10"
        fill="rgba(255,255,255,0.12)"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth="1"
      />

      {/* ── Ear nubs ── */}
      <rect
        x="3"
        y="19"
        width="5"
        height="8"
        rx="2.5"
        fill="rgba(255,255,255,0.25)"
      />
      <rect
        x="44"
        y="19"
        width="5"
        height="8"
        rx="2.5"
        fill="rgba(255,255,255,0.25)"
      />

      {/* ── Eye whites ── */}
      <ellipse
        cx="19"
        cy="23"
        rx="5.5"
        ry="5.5"
        fill={s.eyeColor}
        opacity="0.95"
      />
      <ellipse
        cx="33"
        cy="23"
        rx="5.5"
        ry="5.5"
        fill={s.eyeColor}
        opacity="0.95"
      />

      {/* ── Pupils ── */}
      <circle
        cx="19"
        cy="23"
        r="2.8"
        fill={s.pupilColor}
        style={{ ...eyeStyle, transformOrigin: "19px 23px" }}
      />
      <circle
        cx="33"
        cy="23"
        r="2.8"
        fill={s.pupilColor}
        style={{ ...eyeStyle, transformOrigin: "33px 23px" }}
      />

      {/* ── Pupil highlights ── */}
      <circle cx="20.5" cy="21.5" r="1" fill="rgba(255,255,255,0.7)" />
      <circle cx="34.5" cy="21.5" r="1" fill="rgba(255,255,255,0.7)" />

      {/* ── Blush ── */}
      <ellipse cx="13" cy="28" rx="4" ry="2.5" fill={s.blush} />
      <ellipse cx="39" cy="28" rx="4" ry="2.5" fill={s.blush} />

      {/* ── Mouth ── */}
      {s.mouthType === "smile" && (
        <path
          d="M19 33 Q26 37 33 33"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {s.mouthType === "big-smile" && (
        <>
          <path
            d="M18 32.5 Q26 38.5 34 32.5"
            stroke="rgba(255,255,255,0.9)"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
          <path d="M18 32.5 Q26 38.5 34 32.5" fill="rgba(255,255,255,0.15)" />
        </>
      )}
      {s.mouthType === "hmm" && (
        <path
          d="M20 34 Q26 33 32 34"
          stroke="rgba(255,255,255,0.75)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {s.mouthType === "worried" && (
        <path
          d="M19 36 Q26 32 33 36"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* ── Thinking dots ── */}
      {stateKey === "thinking" && (
        <g>
          <circle
            cx="19"
            cy="44"
            r="2"
            fill="rgba(255,255,255,0.5)"
            style={{ animation: "aa-blink 1s 0s infinite" }}
          />
          <circle
            cx="26"
            cy="44"
            r="2"
            fill="rgba(255,255,255,0.5)"
            style={{ animation: "aa-blink 1s 0.2s infinite" }}
          />
          <circle
            cx="33"
            cy="44"
            r="2"
            fill="rgba(255,255,255,0.5)"
            style={{ animation: "aa-blink 1s 0.4s infinite" }}
          />
        </g>
      )}
    </svg>
  );
}

/* ── Tooltip ────────────────────────────────────────────────────────────── */
function Tooltip({ name, label }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 12px)",
        left: "50%",
        transform: "translateX(-50%)",
        background: C.navy,
        color: "#fff",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: "11px",
        fontWeight: 600,
        whiteSpace: "nowrap",
        padding: "5px 10px",
        borderRadius: "6px",
        border: `1px solid ${C.blue}`,
        boxShadow: "0 4px 20px rgba(15,43,91,0.35)",
        pointerEvents: "none",
        animation: "aa-tooltip-in 0.15s ease both",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "2px",
      }}
    >
      {name}
      <span
        style={{
          fontSize: "10px",
          color: C.textMuted,
          fontWeight: 400,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      {/* caret */}
      <span
        style={{
          position: "absolute",
          top: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          width: 0,
          height: 0,
          borderLeft: "5px solid transparent",
          borderRight: "5px solid transparent",
          borderTop: `5px solid ${C.blue}`,
        }}
      />
    </div>
  );
}

/* ── Dev state picker ───────────────────────────────────────────────────── */
function DevPicker({ current, onChange }) {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        right: 0,
        background: C.navy,
        border: `1px solid ${C.blue}`,
        borderRadius: "8px",
        boxShadow: "0 4px 20px rgba(15,43,91,0.35)",
        padding: "6px",
        display: "flex",
        flexDirection: "column",
        gap: "3px",
        minWidth: "110px",
        animation: "aa-tooltip-in 0.12s ease both",
        zIndex: 1,
      }}
    >
      <div
        style={{
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "9px",
          fontWeight: 600,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: C.textMuted,
          padding: "0 4px 4px",
          borderBottom: `1px solid ${C.textMid}33`,
          marginBottom: "2px",
        }}
      >
        DEV · state
      </div>
      {Object.entries(STATE).map(([key]) => (
        <button
          key={key}
          onPointerDown={(e) => {
            e.stopPropagation();
            onChange(key);
          }}
          style={{
            background: current === key ? C.blue : "transparent",
            border: "none",
            borderRadius: "4px",
            color: current === key ? "#fff" : C.blueLight,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "11px",
            fontWeight: current === key ? 600 : 400,
            padding: "4px 8px",
            textAlign: "left",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background:
                key === "alert"
                  ? C.red
                  : key === "active"
                    ? C.blue
                    : C.textMuted,
              flexShrink: 0,
              opacity: current === key ? 1 : 0.5,
            }}
          />
          {key}
        </button>
      ))}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */
export default function AgentAvatar({
  state: stateKey = "idle",
  name = "Stemy",
}) {
  useInjectStyles();

  const [devOverride, setDevOverride] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const isDev = import.meta.env.DEV;

  const effectiveState = devOverride ?? stateKey;
  const s = STATE[effectiveState] ?? STATE.idle;
  const SIZE = 72;

  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - SIZE - 24,
    y: window.innerHeight - SIZE - 24,
  }));
  const [dragging, setDragging] = useState(false);
  const [hovered, setHovered] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const ref = useRef(null);

  const onPointerDown = useCallback(
    (e) => {
      e.preventDefault();
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      setDragging(true);
      ref.current?.setPointerCapture(e.pointerId);
    },
    [pos],
  );

  const onPointerMove = useCallback(
    (e) => {
      if (!dragging) return;
      setPos({
        x: Math.max(
          0,
          Math.min(window.innerWidth - SIZE, e.clientX - dragOffset.current.x),
        ),
        y: Math.max(
          0,
          Math.min(window.innerHeight - SIZE, e.clientY - dragOffset.current.y),
        ),
      });
    },
    [dragging],
  );

  const onPointerUp = useCallback(() => setDragging(false), []);

  useEffect(() => {
    const onResize = () =>
      setPos((p) => ({
        x: Math.min(p.x, window.innerWidth - SIZE),
        y: Math.min(p.y, window.innerHeight - SIZE),
      }));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: SIZE,
        height: SIZE,
        zIndex: 9999,
        cursor: dragging ? "grabbing" : "grab",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        background: s.bg,
        border: `2.5px solid ${s.border}`,
        boxShadow: `0 6px 28px ${s.glow}, 0 2px 8px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.25)`,
        transform: dragging ? "scale(1.1)" : "scale(1)",
        transition: dragging
          ? "box-shadow 0.1s, transform 0.1s"
          : "box-shadow 0.3s, transform 0.2s, background 0.4s, border-color 0.4s",
        animation: dragging ? "none" : "aa-float 3s ease-in-out infinite",
      }}
    >
      {/* Pulse ring for active state */}
      {s.pulseColor && (
        <div
          style={{
            position: "absolute",
            inset: -6,
            borderRadius: "50%",
            border: `2.5px solid ${s.pulseColor}`,
            animation: "aa-pulse-glow 1.6s ease-out infinite",
            pointerEvents: "none",
          }}
        />
      )}

      <RobotFace state={effectiveState} dragging={dragging} />

      {hovered && !dragging && <Tooltip name={name} label={s.label} />}

      {isDev && (
        <button
          onPointerDown={(e) => {
            e.stopPropagation();
            setPickerOpen((o) => !o);
          }}
          title="Dev: toggle state"
          style={{
            position: "absolute",
            top: -10,
            left: -10,
            width: 20,
            height: 20,
            borderRadius: "50%",
            background: C.navy,
            border: `1px solid ${C.blue}`,
            color: C.textMuted,
            fontSize: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            lineHeight: 1,
          }}
        >
          ⚙
        </button>
      )}

      {isDev && pickerOpen && (
        <DevPicker
          current={effectiveState}
          onChange={(key) => {
            setDevOverride(key);
            setPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
