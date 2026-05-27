"use client";

import {
  Activity,
  ArrowRight,
  BarChart3,
  BrainCircuit,
  Database,
  FileText,
  Gauge,
  Github,
  LineChart,
  Newspaper,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import demoData from "../../public/data/nacf-demo.json";

type CategoryKey =
  | "No_News"
  | "Env_Thermal"
  | "Env_Disaster"
  | "Soc_Calendar"
  | "Soc_Economic"
  | "Grid_Reliability";

type Point = {
  step: number;
  hour: number;
  time: string;
  factual: number;
  baseline: number;
  true: number;
  perturbation: number;
};

type EventItem = {
  type: string;
  category: CategoryKey;
  scope: string;
  relevance: number;
  publicationTime: string;
  text: string;
  justification: string;
  source: string;
};

type CaseItem = {
  slug: string;
  title: string;
  category: CategoryKey;
  contextStart: string;
  forecastStart: string;
  forecastEnd: string;
  eventCount: number;
  categoryCounts: Partial<Record<CategoryKey, number>>;
  meanPerturbation: number;
  absMeanPerturbation: number;
  peakAbsPerturbation: number;
  rmse: number;
  context: {
    meanLoad: number;
    maxLoad: number;
    meanTempC: number;
    maxTempC: number;
    meanHumidity: number;
    maxWind: number;
  };
  events: EventItem[];
  points: Point[];
};

type SummaryItem = {
  category: CategoryKey;
  label: string;
  count: number;
  meanPerturbation: number;
  absMeanPerturbation: number;
  maxAbsPerturbation: number;
};

type ScatterItem = {
  i: number;
  forecastStart: string;
  category: CategoryKey;
  events: number;
  mean: number;
  absMean: number;
};

type DemoData = {
  paper: {
    title: string;
    shortName: string;
    subtitle: string;
    authors: string[];
    venue: string;
  };
  metrics: {
    rmse48: number;
    mae48: number;
    mape48: number;
    meanPerturbation: number;
    maeImprovementRange: string;
    inputHorizon: string;
    forecastHorizon: string;
  };
  dataset: {
    region: string;
    rows: number;
    start: string;
    end: string;
    eventRows: number;
    events: number;
    meanLoad: number;
    loadMin: number;
    loadMax: number;
    tempMinC: number;
    tempMaxC: number;
    categoryCounts: Record<CategoryKey, number>;
  };
  categories: Record<
    CategoryKey,
    { label: string; color: string; description: string }
  >;
  cases: CaseItem[];
  summary: SummaryItem[];
  scatter: ScatterItem[];
};

const data = demoData as DemoData;
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const assetPath = (path: string) => `${basePath}${path}`;

const categoryOrder: CategoryKey[] = [
  "Env_Thermal",
  "Env_Disaster",
  "Soc_Calendar",
  "Soc_Economic",
  "Grid_Reliability",
  "No_News",
];

const probeMultipliers: Record<CategoryKey, number> = {
  No_News: 0,
  Env_Thermal: 0.78,
  Env_Disaster: 1.08,
  Soc_Calendar: 0.92,
  Soc_Economic: 0.86,
  Grid_Reliability: 0.62,
};

const probeNames: Record<CategoryKey, string> = {
  No_News: "No-event baseline",
  Env_Thermal: "Heatwave alert",
  Env_Disaster: "Bushfire disruption",
  Soc_Calendar: "Major holiday",
  Soc_Economic: "Demand response",
  Grid_Reliability: "Reserve warning",
};

function formatMw(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${Math.round(value).toLocaleString()} MW`;
}

function formatMetric(value: number, suffix = "") {
  return `${value.toLocaleString(undefined, {
    maximumFractionDigits: value > 100 ? 0 : 2,
  })}${suffix}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function makePath(
  values: number[],
  min: number,
  max: number,
  width: number,
  height: number,
  pad: number,
) {
  const usableW = width - pad * 2;
  const usableH = height - pad * 2;
  return values
    .map((value, index) => {
      const x = pad + (index / Math.max(1, values.length - 1)) * usableW;
      const y = pad + (1 - (value - min) / Math.max(1, max - min)) * usableH;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function HeroSignal() {
  const caseItem = data.cases.find((item) => item.slug === "disaster-bushfire")!;
  const width = 620;
  const height = 520;
  const pad = 46;
  const values = caseItem.points.flatMap((point) => [
    point.factual,
    point.baseline,
    point.true,
  ]);
  const min = Math.min(...values) - 260;
  const max = Math.max(...values) + 260;
  const factualPath = makePath(
    caseItem.points.map((point) => point.factual),
    min,
    max,
    width,
    height,
    pad,
  );
  const baselinePath = makePath(
    caseItem.points.map((point) => point.baseline),
    min,
    max,
    width,
    height,
    pad,
  );
  const truePath = makePath(
    caseItem.points.map((point) => point.true),
    min,
    max,
    width,
    height,
    pad,
  );

  return (
    <svg className="hero-visual" viewBox={`0 0 ${width} ${height}`} role="img">
      <defs>
        <linearGradient id="heroWash" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor="#fffdf8" />
          <stop offset="1" stopColor="#dbe7df" />
        </linearGradient>
        <pattern id="grid" width="38" height="38" patternUnits="userSpaceOnUse">
          <path d="M 38 0 L 0 0 0 38" fill="none" stroke="#d7d1c2" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#heroWash)" />
      <rect width={width} height={height} fill="url(#grid)" opacity="0.55" />
      {[0, 1, 2, 3].map((line) => (
        <line
          key={line}
          x1={pad}
          x2={width - pad}
          y1={pad + line * 104}
          y2={pad + line * 104}
          stroke="#c8c0ae"
          strokeDasharray="5 8"
        />
      ))}
      <path d={baselinePath} fill="none" stroke="#64748b" strokeDasharray="9 8" strokeWidth="4" />
      <path d={truePath} fill="none" stroke="#111827" strokeWidth="3" opacity="0.72" />
      <path d={factualPath} fill="none" stroke="#0f766e" strokeWidth="5" />
      {caseItem.points.filter((_, index) => index % 8 === 0).map((point, index) => {
        const x = pad + ((point.step - 1) / 47) * (width - pad * 2);
        const y =
          pad +
          (1 - (point.factual - min) / Math.max(1, max - min)) *
            (height - pad * 2);
        return (
          <circle
            key={point.step}
            cx={x}
            cy={y}
            r={index % 2 ? 4.5 : 6}
            fill="#0f766e"
            opacity={index % 2 ? 0.5 : 0.9}
          />
        );
      })}
      <g transform="translate(42 36)">
        <rect width="250" height="80" rx="9" fill="#fffdf8" opacity="0.9" />
        <text x="18" y="29" fill="#17201d" fontSize="18" fontWeight="760">
          Factual vs no-event baseline
        </text>
        <text x="18" y="56" fill="#62716b" fontSize="14">
          local counterfactual comparison
        </text>
      </g>
    </svg>
  );
}

function ForecastChart({
  points,
  customValues,
}: {
  points: Point[];
  customValues: number[];
}) {
  const width = 980;
  const height = 430;
  const pad = 56;
  const seriesValues = points.flatMap((point, index) => [
    point.factual,
    point.baseline,
    point.true,
    customValues[index],
  ]);
  const min = Math.floor((Math.min(...seriesValues) - 360) / 500) * 500;
  const max = Math.ceil((Math.max(...seriesValues) + 360) / 500) * 500;
  const factual = makePath(
    points.map((point) => point.factual),
    min,
    max,
    width,
    height,
    pad,
  );
  const baseline = makePath(
    points.map((point) => point.baseline),
    min,
    max,
    width,
    height,
    pad,
  );
  const truth = makePath(
    points.map((point) => point.true),
    min,
    max,
    width,
    height,
    pad,
  );
  const custom = makePath(customValues, min, max, width, height, pad);
  const areaPath = `${baseline} ${custom
    .split(" ")
    .reverse()
    .join(" ")} Z`;
  const ticks = [0, 12, 24, 36, 47];
  const yTicks = [min, min + (max - min) / 2, max];

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img">
      <defs>
        <linearGradient id="perturbArea" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#0f766e" stopOpacity="0.22" />
          <stop offset="1" stopColor="#0f766e" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={width} height={height} fill="transparent" />
      {yTicks.map((tick) => {
        const y = pad + (1 - (tick - min) / (max - min)) * (height - pad * 2);
        return (
          <g key={tick}>
            <line
              x1={pad}
              x2={width - pad}
              y1={y}
              y2={y}
              stroke="#d6d0c1"
              strokeDasharray="5 7"
            />
            <text x={14} y={y + 4} className="axis-text">
              {Math.round(tick).toLocaleString()}
            </text>
          </g>
        );
      })}
      {ticks.map((index) => {
        const x = pad + (index / 47) * (width - pad * 2);
        return (
          <g key={index}>
            <line x1={x} x2={x} y1={pad} y2={height - pad} stroke="#e3dece" />
            <text x={x - 14} y={height - 18} className="axis-text">
              {points[index].hour}h
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#perturbArea)" opacity="0.95" />
      <path d={baseline} fill="none" stroke="#64748b" strokeWidth="3.5" strokeDasharray="9 8" />
      <path d={truth} fill="none" stroke="#17201d" strokeWidth="3" opacity="0.65" />
      <path d={factual} fill="none" stroke="#0891b2" strokeWidth="3.5" opacity="0.82" />
      <path d={custom} fill="none" stroke="#0f766e" strokeWidth="4.5" />
      <text x={pad} y={28} fill="#62716b" fontSize="13" fontWeight="700">
        Demand, MW
      </text>
      <text x={width - pad - 88} y={height - 18} fill="#62716b" fontSize="13" fontWeight="700">
        Forecast horizon
      </text>
    </svg>
  );
}

function PerturbationChart({
  points,
  customValues,
}: {
  points: Point[];
  customValues: number[];
}) {
  const width = 980;
  const height = 185;
  const pad = 42;
  const values = customValues.map((value, index) => value - points[index].baseline);
  const magnitude = Math.max(120, ...values.map((value) => Math.abs(value)));
  const min = -magnitude * 1.15;
  const max = magnitude * 1.15;
  const path = makePath(values, min, max, width, height, pad);
  const zeroY = pad + (1 - (0 - min) / (max - min)) * (height - pad * 2);

  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img">
      <line
        x1={pad}
        x2={width - pad}
        y1={zeroY}
        y2={zeroY}
        stroke="#b7b09f"
        strokeWidth="1.5"
      />
      <text x="14" y={zeroY - 8} className="axis-text">
        0
      </text>
      <path d={path} fill="none" stroke="#dc2626" strokeWidth="4" />
      {values.filter((_, index) => index % 8 === 0).map((value, seriesIndex) => {
        const originalIndex = seriesIndex * 8;
        const x = pad + (originalIndex / 47) * (width - pad * 2);
        const y = pad + (1 - (value - min) / (max - min)) * (height - pad * 2);
        return <circle key={originalIndex} cx={x} cy={y} r="4" fill="#dc2626" />;
      })}
      <text x={pad} y={26} fill="#62716b" fontSize="13" fontWeight="700">
        Custom perturbation relative to no-event baseline
      </text>
      <text x={width - pad - 92} y={height - 14} fill="#62716b" fontSize="12">
        half-hour steps
      </text>
    </svg>
  );
}

function ScatterPanel() {
  const width = 760;
  const height = 250;
  const pad = 34;
  const maxX = Math.max(...data.scatter.map((item) => item.events), 1);
  const maxY = Math.max(...data.scatter.map((item) => item.absMean), 1);

  return (
    <div className="scatter">
      <svg className="chart" viewBox={`0 0 ${width} ${height}`} role="img">
        <line x1={pad} x2={width - pad} y1={height - pad} y2={height - pad} stroke="#cac2b0" />
        <line x1={pad} x2={pad} y1={pad} y2={height - pad} stroke="#cac2b0" />
        {data.scatter.map((item) => {
          const x = pad + (item.events / maxX) * (width - pad * 2);
          const y = height - pad - (item.absMean / maxY) * (height - pad * 2);
          const color = data.categories[item.category].color;
          return (
            <circle
              key={`${item.i}-${item.forecastStart}`}
              cx={x}
              cy={y}
              r={item.absMean > 700 ? 4.5 : 3}
              fill={color}
              opacity={item.absMean > 700 ? 0.82 : 0.42}
            />
          );
        })}
        <text x={pad} y={22} fill="#62716b" fontSize="12" fontWeight="700">
          Preprocessed test windows: event count vs Abs-MP
        </text>
        <text x={width - 170} y={height - 10} fill="#62716b" fontSize="11">
          extracted events
        </text>
      </svg>
    </div>
  );
}

function InteractiveDemo() {
  const [caseSlug, setCaseSlug] = useState(data.cases[2].slug);
  const [mode, setMode] = useState<"observed" | "custom">("observed");
  const [probe, setProbe] = useState<CategoryKey>("Env_Disaster");
  const [intensity, setIntensity] = useState(100);

  const activeCase = data.cases.find((item) => item.slug === caseSlug) ?? data.cases[0];
  const activeColor = data.categories[activeCase.category].color;

  const customValues = useMemo(() => {
    if (mode === "observed") {
      return activeCase.points.map((point) => point.factual);
    }
    const multiplier = probeMultipliers[probe] * (intensity / 100);
    return activeCase.points.map((point, index) => {
      const observedEffect = point.factual - point.baseline;
      const periodicAdjustment = Math.sin((index / 47) * Math.PI) * 0.08 + 1;
      return point.baseline + observedEffect * multiplier * periodicAdjustment;
    });
  }, [activeCase, intensity, mode, probe]);

  const customPerturbations = customValues.map(
    (value, index) => value - activeCase.points[index].baseline,
  );
  const meanPerturbation =
    customPerturbations.reduce((sum, value) => sum + value, 0) /
    customPerturbations.length;
  const peakPerturbation = customPerturbations.reduce(
    (peak, value) => (Math.abs(value) > Math.abs(peak) ? value : peak),
    0,
  );
  const absMean =
    customPerturbations.reduce((sum, value) => sum + Math.abs(value), 0) /
    customPerturbations.length;

  return (
    <div className="interactive">
      <aside className="control-panel">
        <div className="field">
          <label htmlFor="case-select">Preprocessed window</label>
          <select
            id="case-select"
            value={caseSlug}
            onChange={(event) => setCaseSlug(event.target.value)}
          >
            {data.cases.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.title}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <span className="toggle-label">Treatment mode</span>
          <div className="segmented" aria-label="Treatment mode">
            <button
              className={mode === "observed" ? "active" : ""}
              type="button"
              onClick={() => setMode("observed")}
            >
              Observed
            </button>
            <button
              className={mode === "custom" ? "active" : ""}
              type="button"
              onClick={() => setMode("custom")}
            >
              Custom
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="intensity">Synthetic news intensity: {intensity}%</label>
          <input
            id="intensity"
            type="range"
            min="0"
            max="160"
            value={intensity}
            disabled={mode === "observed"}
            onChange={(event) => setIntensity(Number(event.target.value))}
          />
        </div>

        <div className="field">
          <span className="toggle-label">Synthetic category probe</span>
          <div className="category-buttons">
            {categoryOrder.slice(0, 5).map((key) => (
              <button
                key={key}
                className={`category-button ${probe === key ? "active" : ""}`}
                style={{ "--cat": data.categories[key].color } as React.CSSProperties}
                type="button"
                onClick={() => {
                  setProbe(key);
                  setMode("custom");
                }}
              >
                <span className="category-label">
                  <span className="swatch" />
                  {probeNames[key]}
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </div>

        <div className="case-stats">
          <div className="case-stat">
            <strong>{formatMw(meanPerturbation)}</strong>
            <span>Mean perturbation</span>
          </div>
          <div className="case-stat">
            <strong>{formatMw(peakPerturbation)}</strong>
            <span>Peak signed effect</span>
          </div>
          <div className="case-stat">
            <strong>{formatMetric(absMean, " MW")}</strong>
            <span>Abs-MP</span>
          </div>
          <div className="case-stat">
            <strong>{activeCase.eventCount}</strong>
            <span>Extracted events</span>
          </div>
        </div>
      </aside>

      <div className="chart-panel">
        <div className="interactive-title">
          <div>
            <h3>{activeCase.title}</h3>
            <p>
              Forecast starts {activeCase.forecastStart}. The no-event baseline holds
              the same operating context and masks the news treatment.
            </p>
          </div>
          <span className="badge" style={{ color: activeColor }}>
            <Activity size={15} />
            {data.categories[activeCase.category].label}
          </span>
        </div>
        <div className="chart-wrap">
          <ForecastChart points={activeCase.points} customValues={customValues} />
          <PerturbationChart points={activeCase.points} customValues={customValues} />
        </div>
        <div className="legend">
          <span className="legend-item">
            <span className="legend-line" style={{ "--legend": "#0f766e" } as React.CSSProperties} />
            Custom / selected treatment
          </span>
          <span className="legend-item">
            <span className="legend-line" style={{ "--legend": "#0891b2" } as React.CSSProperties} />
            Observed factual
          </span>
          <span className="legend-item">
            <span className="legend-line" style={{ "--legend": "#64748b" } as React.CSSProperties} />
            No-event baseline
          </span>
          <span className="legend-item">
            <span className="legend-line" style={{ "--legend": "#17201d" } as React.CSSProperties} />
            True load
          </span>
        </div>
      </div>

      <div className="below-grid">
        <div className="events-panel">
          <div className="mini-title">
            <span>Structured news in this window</span>
            <Newspaper size={17} />
          </div>
          <div className="events-list">
            {activeCase.events.length ? (
              activeCase.events.slice(0, 4).map((event) => (
                <article className="event-item" key={`${event.publicationTime}-${event.text}`}>
                  <div className="event-meta">
                    <span
                      className="pill"
                      style={
                        {
                          "--cat": data.categories[event.category]?.color ?? "#64748b",
                        } as React.CSSProperties
                      }
                    >
                      {data.categories[event.category]?.label ?? event.category}
                    </span>
                    <span className="pill" style={{ "--cat": "#64748b" } as React.CSSProperties}>
                      relevance {event.relevance}
                    </span>
                  </div>
                  <p>{event.text}</p>
                </article>
              ))
            ) : (
              <article className="event-item">
                <p>No demand-relevant news event was extracted for this window.</p>
              </article>
            )}
          </div>
        </div>

        <div className="summary-panel">
          <div className="mini-title">
            <span>Demo database summary</span>
            <Database size={17} />
          </div>
          <div className="summary-bars">
            {data.summary
              .filter((item) => item.category !== "No_News")
              .map((item) => {
                const max = Math.max(...data.summary.map((entry) => entry.absMeanPerturbation));
                return (
                  <div
                    className="bar-row"
                    key={item.category}
                    style={
                      {
                        "--cat": data.categories[item.category].color,
                      } as React.CSSProperties
                    }
                  >
                    <span>{item.label}</span>
                    <span className="bar-track">
                      <span
                        className="bar-fill"
                        style={{
                          width: `${clamp((item.absMeanPerturbation / max) * 100, 2, 100)}%`,
                        }}
                      />
                    </span>
                    <span>{Math.round(item.absMeanPerturbation)} MW</span>
                  </div>
                );
              })}
          </div>
          <ScatterPanel />
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <main className="page">
      <nav className="nav" aria-label="Main navigation">
        <a className="brand" href="#top">
          <span className="brand-mark">
            <Zap size={19} />
          </span>
          <span>NACF Counterfactual Load Forecasting</span>
        </a>
        <div className="nav-links">
          <a href="#method">Method</a>
          <a href="#results">Results</a>
          <a href="#demo">Demo</a>
          <a href="#case">Case Study</a>
          <a className="nav-action" href={assetPath("/data/nacf-demo.json")} download>
            <Database size={15} />
            Demo Data
          </a>
        </div>
      </nav>

      <section className="hero" id="top">
        <div className="hero-grid">
          <div>
            <p className="eyebrow">
              <Sparkles size={16} />
              Academic project website
            </p>
            <h1>
              Counterfactual
              <span>Load Forecasting</span>
            </h1>
            <p className="hero-copy">
              {data.paper.subtitle}. The site presents the paper, the NACF model,
              forecasting results, and a browser-only demo for factual versus
              no-event load trajectories.
            </p>
            <div className="hero-actions">
              <a className="button primary" href="#demo">
                <SlidersHorizontal size={18} />
                Open Interactive Demo
              </a>
              <a className="button secondary" href="#method">
                <FileText size={18} />
                Read Method
              </a>
            </div>
          </div>

          <div className="hero-panel" aria-label="Factual and counterfactual load signal">
            <HeroSignal />
            <div className="hero-overlay">
              <div className="mini-console">
                <div className="mini-title">
                  <span>News-aware baseline comparison</span>
                  <Gauge size={17} />
                </div>
                <p>
                  Factual forecast and no-event baseline are evaluated under the
                  same historical load, weather, and calendar context.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-metrics">
          <div className="metric">
            <strong>{formatMetric(data.metrics.mae48, " MW")}</strong>
            <span>Day-ahead MAE on the 48 to 48 setting</span>
          </div>
          <div className="metric">
            <strong>{formatMetric(data.metrics.rmse48, " MW")}</strong>
            <span>Day-ahead RMSE in the original demand scale</span>
          </div>
          <div className="metric">
            <strong>{data.metrics.maeImprovementRange}</strong>
            <span>MAE improvement over the strongest baselines</span>
          </div>
          <div className="metric">
            <strong>{formatMw(data.metrics.meanPerturbation)}</strong>
            <span>Mean factual minus no-event perturbation in the trained result</span>
          </div>
        </div>
      </section>

      <section className="section" id="paper">
        <div className="section-inner">
          <div className="section-head">
            <div>
              <p className="section-kicker">Paper</p>
              <h2>What This Work Studies</h2>
            </div>
            <p className="section-lede">
              The paper reframes news-augmented load forecasting as event-driven
              demand perturbation analysis. Instead of only asking whether news
              improves point forecasts, NACF asks how the predicted load changes
              when the same operating state is evaluated with observed news versus
              a no-event baseline.
            </p>
          </div>
          <div className="metric-grid">
            <div className="stat">
              <strong>{data.dataset.rows.toLocaleString()}</strong>
              <span>Half-hourly NSW observations in the prepared 2019 dataset</span>
            </div>
            <div className="stat">
              <strong>{data.dataset.events.toLocaleString()}</strong>
              <span>LLM-extracted demand-relevant news events in the local demo data</span>
            </div>
            <div className="stat">
              <strong>48</strong>
              <span>Historical steps and forecast steps used by the interactive demo</span>
            </div>
            <div className="stat">
              <strong>5</strong>
              <span>Structured event categories spanning environment, society, and grid</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="method">
        <div className="section-inner">
          <div className="section-head">
            <div>
              <p className="section-kicker">NACF Method</p>
              <h2>News-Aware Context Balancing</h2>
            </div>
            <p className="section-lede">
              NACF combines multivariate time-series encoding, structured news
              treatment encoding, a treatment-dependent response network, and
              IPM-based representation balancing. The balancing step reduces the
              degree to which treatment intensity is entangled with observed load,
              weather, and calendar conditions.
            </p>
          </div>

          <div className="two-col">
            <div className="method-flow">
              <div className="flow-step">
                <Search size={26} />
                <div>
                  <h3>Structured event extraction</h3>
                  <p>
                    News articles are converted into category, temporal type,
                    scope, relevance, and text fields used as an intervenable
                    treatment representation.
                  </p>
                </div>
              </div>
              <div className="flow-step">
                <BrainCircuit size={26} />
                <div>
                  <h3>Operating-context encoder</h3>
                  <p>
                    Load, weather, and calendar histories are encoded into a
                    latent operating state that supports factual and baseline
                    forecasts under the same context.
                  </p>
                </div>
              </div>
              <div className="flow-step">
                <ShieldCheck size={26} />
                <div>
                  <h3>Reweighting and IPM regularization</h3>
                  <p>
                    Reweighting and MMD-based IPM loss encourage comparable
                    representations across treatment-intensity groups.
                  </p>
                </div>
              </div>
              <div className="flow-step">
                <LineChart size={26} />
                <div>
                  <h3>Factual versus no-event comparison</h3>
                  <p>
                    The estimated perturbation is the horizon-wise difference
                    between the observed-news forecast and the no-news baseline.
                  </p>
                </div>
              </div>
            </div>

            <div className="paper-figure">
              <div className="figure-frame">
                <object
                data={assetPath("/figures/model_structure_diagram.pdf")}
                  type="application/pdf"
                  title="NACF model structure"
                >
                  <img src={assetPath("/figures/representation_balance.png")} alt="NACF model structure" />
                </object>
              </div>
              <p className="figure-caption">
                Paper figure: the framework connects context encoding, treatment
                encoding, varying-coefficient response modeling, and balanced
                training objectives.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="results">
        <div className="section-inner">
          <div className="section-head">
            <div>
              <p className="section-kicker">Results</p>
              <h2>Forecasting and Diagnostics</h2>
            </div>
            <p className="section-lede">
              The website reuses figures from the manuscript and the trained
              result folder. The key message is that the factual forecast remains
              competitive while the model exposes interpretable event-driven
              perturbation estimates.
            </p>
          </div>
          <div className="results-grid">
            <article className="figure-tile">
              <img src={assetPath("/figures/category_perturbations.png")} alt="Category-specific perturbations" />
              <h3>Category-specific perturbations</h3>
              <p>
                Environmental thermal news has the highest Abs-CMP in the paper,
                while social events show strong bidirectional window effects.
              </p>
            </article>
            <article className="figure-tile">
              <img src={assetPath("/figures/ablation_rmse.png")} alt="Ablation RMSE" />
              <h3>Ablation study</h3>
              <p>
                Removing reweighting or IPM regularization increases RMSE,
                especially in the day-ahead and two-day settings.
              </p>
            </article>
            <article className="figure-tile">
              <img src={assetPath("/figures/combined_sensitivity.png")} alt="Sensitivity analysis" />
              <h3>Balance-accuracy trade-off</h3>
              <p>
                The selected IPM weight sits near the practical elbow between
                prediction loss and representation balance.
              </p>
            </article>
            <article className="figure-tile">
              <img src={assetPath("/figures/intensity_distributions.png")} alt="News treatment intensity" />
              <h3>Treatment intensity</h3>
              <p>
                Learned news intensity remains graded rather than collapsing all
                news windows into a single treatment state.
              </p>
            </article>
            <article className="figure-tile">
              <img src={assetPath("/figures/representation_balance.png")} alt="Representation balance" />
              <h3>Representation balance</h3>
              <p>
                The full model substantially reduces treatment-group discrepancy
                in the learned operating-context representation.
              </p>
            </article>
            <article className="figure-tile">
              <img src={assetPath("/figures/synthetic_news_probes.png")} alt="Synthetic news probes" />
              <h3>Synthetic probes</h3>
              <p>
                Controlled event texts produce differentiated response surfaces
                while holding the historical operating context fixed.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section" id="demo">
        <div className="section-inner">
          <div className="section-head">
            <div>
              <p className="section-kicker">Interactive Demo</p>
              <h2>Browser-Only Counterfactual Tool</h2>
            </div>
            <p className="section-lede">
              Select a preprocessed test window, compare factual and no-event
              curves, then switch to custom mode to scale a synthetic event
              category. This is an illustrative database demo: it uses exported
              predictions and news metadata, not the model checkpoint.
            </p>
          </div>
          <InteractiveDemo />
        </div>
      </section>

      <section className="section" id="case">
        <div className="section-inner">
          <div className="section-head">
            <div>
              <p className="section-kicker">Case Study</p>
              <h2>COVID-19 Lockdown Perturbation</h2>
            </div>
            <p className="section-lede">
              The manuscript case study analyzes March 19 to 22, 2020 in NSW.
              Lockdown-related restrictions, isolation behavior, and economic
              shutdown signals dominate a concurrent heatwave context and yield a
              sustained negative model-estimated perturbation.
            </p>
          </div>
          <div className="case-study">
            <div className="figure-frame">
              <img
                src={assetPath("/figures/window_0039_with_news_table.png")}
                alt="COVID-19 lockdown perturbation case study"
              />
            </div>
            <p className="figure-caption">
              Paper figure: factual forecast, baseline no-event forecast, true
              future load, net perturbation, and representative high-relevance
              news signals in the same historical window.
            </p>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-inner">
          <span>
            {data.paper.title} · {data.paper.authors.join(", ")}
          </span>
          <span>
            Demo data generated from processed predictions under{" "}
            {data.dataset.region}.
          </span>
        </div>
      </footer>
    </main>
  );
}
