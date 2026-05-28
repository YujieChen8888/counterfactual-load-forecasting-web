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
import katex from "katex";
import "katex/dist/katex.min.css";
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

type HistoryPoint = {
  step: number;
  time: string;
  load: number;
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
  timestep?: number;
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
  history?: HistoryPoint[];
  points: Point[];
};

type CustomScenarioPoint = {
  step: number;
  hour: number;
  time: string;
  custom: number;
  perturbation: number;
  differenceFromFactual: number;
};

type CustomScenario = {
  id: string;
  label: string;
  category: CategoryKey;
  notebookCategory: string;
  meanVsNoNews: number;
  meanVsFactual: number;
  absMeanVsNoNews: number;
  peakVsNoNews: number;
  events: EventItem[];
  points: CustomScenarioPoint[];
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
    categoryCounts: Partial<Record<CategoryKey, number>>;
  };
  categories: Record<
    CategoryKey,
    { label: string; color: string; description: string }
  >;
  cases: CaseItem[];
  customScenarios: CustomScenario[];
  summary: SummaryItem[];
  scatter: ScatterItem[];
  notebook: {
    source: string;
    checkpoint: string;
    meanFactualVsNoNews: number;
    description: string;
  };
};

const data = demoData as DemoData;
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
const assetPath = (path: string) => `${basePath}${path}`;

function MathBlock({ expression }: { expression: string }) {
  return (
    <div
      className="formula math-formula"
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(expression, {
          displayMode: true,
          throwOnError: false,
          strict: "ignore",
        }),
      }}
    />
  );
}

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
  const caseItem = data.cases[0];
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
        <rect width="272" height="80" rx="9" fill="#fffdf8" opacity="0.9" />
        <text x="18" y="29" fill="#17201d" fontSize="18" fontWeight="760">
          Observed-news prediction
        </text>
        <text x="18" y="56" fill="#62716b" fontSize="14">
          alternative-treatment comparison
        </text>
      </g>
    </svg>
  );
}

function ForecastChart({
  points,
  customValues,
  mode,
}: {
  points: Point[];
  customValues: number[];
  mode: "observed" | "custom";
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
      {mode === "custom" && <path d={custom} fill="none" stroke="#0f766e" strokeWidth="4.5" />}
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
  mode,
}: {
  points: Point[];
  customValues: number[];
  mode: "observed" | "custom";
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
        {mode === "custom"
          ? "Injected-event scenario minus reference treatment"
          : "Observed-news treatment minus reference treatment"}
      </text>
      <text x={width - pad - 92} y={height - 14} fill="#62716b" fontSize="12">
        half-hour steps
      </text>
    </svg>
  );
}

function ScatterPanel() {
  if (!data.scatter.length) {
    return null;
  }

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
  const [caseSlug, setCaseSlug] = useState(data.cases[0].slug);
  const [mode, setMode] = useState<"observed" | "custom">("observed");
  const [scenarioId, setScenarioId] = useState(
    data.customScenarios.find((scenario) => scenario.id === "storm_outage")?.id ??
      data.customScenarios[0].id,
  );
  const [intensity, setIntensity] = useState(100);

  const activeCase = data.cases.find((item) => item.slug === caseSlug) ?? data.cases[0];
  const activeColor = data.categories[activeCase.category].color;
  const activeScenario =
    data.customScenarios.find((scenario) => scenario.id === scenarioId) ??
    data.customScenarios[0];
  const scenarioColor = data.categories[activeScenario.category].color;

  const customValues = useMemo(() => {
    if (mode === "observed") {
      return activeCase.points.map((point) => point.factual);
    }
    const blend = intensity / 100;
    return activeCase.points.map((point, index) => {
      const scenarioPoint = activeScenario.points[index];
      return point.baseline + (scenarioPoint.custom - point.baseline) * blend;
    });
  }, [activeCase, activeScenario, intensity, mode]);

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
          <label htmlFor="intensity">Custom scenario blend: {intensity}%</label>
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
          <span className="toggle-label">Notebook custom-news scenario</span>
          <div className="category-buttons">
            {data.customScenarios.map((scenario) => (
              <button
                key={scenario.id}
                className={`category-button ${scenarioId === scenario.id ? "active" : ""}`}
                style={{ "--cat": data.categories[scenario.category].color } as React.CSSProperties}
                type="button"
                onClick={() => {
                  setScenarioId(scenario.id);
                  setMode("custom");
                }}
              >
                <span className="category-label">
                  <span className="swatch" />
                  {scenario.label}
                </span>
                <ArrowRight size={16} />
              </button>
            ))}
          </div>
        </div>

        <div className="case-stats">
          <div className="case-stat">
            <strong>{formatMw(meanPerturbation)}</strong>
            <span>
              {mode === "custom"
                ? "Mean injected vs reference"
                : "Mean observed vs reference"}
            </span>
          </div>
          <div className="case-stat">
            <strong>{formatMw(peakPerturbation)}</strong>
            <span>Peak signed perturbation</span>
          </div>
          <div className="case-stat">
            <strong>{formatMetric(absMean, " MW")}</strong>
            <span>Abs-MP diagnostic</span>
          </div>
          <div className="case-stat">
            <strong>{mode === "custom" ? activeScenario.events.length : activeCase.eventCount}</strong>
            <span>{mode === "custom" ? "Injected events" : "Observed events"}</span>
          </div>
        </div>
      </aside>

      <div className="chart-panel">
        <div className="interactive-title">
          <div>
            <h3>{activeCase.title}</h3>
            <p>
              Forecast starts {activeCase.forecastStart}. The comparison holds the
              same load, weather, and calendar history while changing the news
              treatment representation.
            </p>
          </div>
          <span className="badge" style={{ color: mode === "custom" ? scenarioColor : activeColor }}>
            <Activity size={15} />
            {mode === "custom"
              ? data.categories[activeScenario.category].label
              : data.categories[activeCase.category].label}
          </span>
        </div>
        <div className="chart-wrap">
          <ForecastChart points={activeCase.points} customValues={customValues} mode={mode} />
          <PerturbationChart points={activeCase.points} customValues={customValues} mode={mode} />
        </div>
        <div className="legend">
          {mode === "custom" && (
            <span className="legend-item">
              <span className="legend-line" style={{ "--legend": "#0f766e" } as React.CSSProperties} />
              Forecast under injected news scenario
            </span>
          )}
          <span className="legend-item">
            <span className="legend-line" style={{ "--legend": "#0891b2" } as React.CSSProperties} />
            Forecast under observed news (factual)
          </span>
          <span className="legend-item">
            <span className="legend-line dashed" style={{ "--legend": "#64748b" } as React.CSSProperties} />
            Forecast under no-news baseline (counterfactual)
          </span>
          <span className="legend-item">
            <span className="legend-line" style={{ "--legend": "#17201d" } as React.CSSProperties} />
            True load (ground truth)
          </span>
        </div>
      </div>

      <div className="below-grid">
        <div className="events-panel">
          <div className="mini-title">
            <span>{mode === "custom" ? "Injected custom news" : "Observed news in this window"}</span>
            <Newspaper size={17} />
          </div>
          <div className="events-list">
            {(mode === "custom" ? activeScenario.events : activeCase.events).length ? (
              (mode === "custom" ? activeScenario.events : activeCase.events).slice(0, 4).map((event) => (
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
                <p>No demand-relevant news event is present for this selection.</p>
              </article>
            )}
          </div>
        </div>

        <div className="summary-panel">
          <div className="mini-title">
            <span>Notebook scenario summary</span>
            <Database size={17} />
          </div>
          <p className="panel-note">
            Exported from {data.notebook.source}: factual prediction with observed
            news, reference-treatment counterfactual prediction, and custom-news
            scenario prediction under one shared historical context.
          </p>
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
          <a href="#motivation">Why Counterfactual</a>
          <a href="#theory">Theory</a>
          <a href="#method">Method</a>
          <a href="#results">Results</a>
          <a href="#demo">Demo</a>
          <a href="#case">Case Study</a>
          <a className="nav-action" href="#demo" onClick={(e) => { e.preventDefault(); document.getElementById('demo')?.scrollIntoView({ behavior: 'smooth' }); }}>
            <Database size={15} />
            Demo
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
              News-reported social, environmental, and grid events can reshape
              electricity demand beyond regular historical, weather, and
              calendar patterns. NACF treats news as an intervenable semantic
              treatment and estimates how the forecasted load trajectory changes
              when observed events are removed or anticipated scenarios are
              injected under the same historical context.
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
                  <span>Counterfactual load analysis</span>
                  <Gauge size={17} />
                </div>
                <p>
                  Factual forecasts are paired with counterfactual trajectories
                  under alternative news treatments to estimate news-related
                  demand perturbations.
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
            <span>Mean observed-news minus reference-treatment comparison</span>
          </div>
        </div>
      </section>

      <section className="section" id="motivation">
        <div className="section-inner">
          <div className="section-head">
            <div>
              <p className="section-kicker">Motivation</p>
              <h2>Background and Motivation</h2>
            </div>
            <p className="section-lede">
              Modern power systems are increasingly affected by non-periodic
              social and operational shocks, including public health emergencies,
              emergency restrictions, policy interventions, and infrastructure
              disruptions. Many of these events are first reported, updated, and
              interpreted through news, making news text important for
              understanding event-driven demand changes.
            </p>
          </div>
          <div className="intro-layout">
            <div className="intro-argument">
              <article className="argument-step">
                <span>01</span>
                <div>
                  <h3>Operational question</h3>
                  <p>
                    For grid operators, the value is not only knowing the future
                    load trajectory, but also assessing how that trajectory would
                    change under different news-event conditions.
                  </p>
                </div>
              </article>
              <article className="argument-step">
                <span>02</span>
                <div>
                  <h3>Limit of factual prediction</h3>
                  <p>
                    Existing news-augmented load forecasting studies use news as
                    an auxiliary feature to reduce point-forecast error, but they
                    cannot answer what the load trajectory would be if the news
                    condition were different.
                  </p>
                </div>
              </article>
              <article className="argument-step">
                <span>03</span>
                <div>
                  <h3>Counterfactual load forecasting</h3>
                  <p>
                    Counterfactual analysis estimates the demand perturbation
                    associated with removing an observed event or injecting an
                    anticipated event scenario while keeping the same historical
                    operating context.
                  </p>
                </div>
              </article>
              <article className="argument-step">
                <span>04</span>
                <div>
                  <h3>Observed-confounding adjustment</h3>
                  <p>
                    The same high temperatures that drive cooling demand can also
                    trigger weather-warning news. NACF therefore learns a
                    confounder representation and balances it across
                    treatment-intensity groups.
                  </p>
                </div>
              </article>
            </div>

            <div className="paper-figure intro-figure">
              <div className="figure-frame">
                <img
                  src={assetPath("/figures/intro_motivation.png")}
                  alt="Comparison between existing news-augmented forecasting and the proposed NACF framework"
                />
              </div>
              <p className="figure-caption">
                Paper Figure Intro_motivation: comparison between existing
                news-augmented forecasting and the proposed NACF framework. NACF
                not only produces factual load forecasts, but also enables
                explicit changes to news interventions for counterfactual
                prediction.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="theory">
        <div className="section-inner">
          <div className="section-head">
            <div>
              <p className="section-kicker">Theoretical Foundations</p>
              <h2>Counterfactual Error Is Unobserved</h2>
            </div>
            <p className="section-lede">
              Counterfactual outcomes are never observed, so the counterfactual
              prediction error cannot be directly minimized from data. NACF
              formalizes news as a continuous treatment in a potential-outcome
              framework and uses a continuous-treatment generalization bound to
              connect this unobservable error with observable training
              objectives.
            </p>
          </div>

          <div className="theory-grid">
            <article className="theory-card">
              <div className="comparison-icon">
                <Database size={24} />
              </div>
              <h3>Observational sample</h3>
              <p>
                Each sample contains the historical multivariate time series,
                the continuous semantic treatment encoding news information, and
                the future load trajectory.
              </p>
              <MathBlock
                expression={String.raw`\begin{aligned}
\mathcal{D}&=\{(\mathbf{X}_i,T_i,Y_i)\}_{i=1}^{n},\\
Y&=Y(T),\\
\mu(t,\mathbf{x})&=\mathbb{E}[Y(t)\mid \mathbf{X}=\mathbf{x}]
\end{aligned}`}
              />
              <p className="formula-note">
                X includes load, meteorological variables, and calendar
                indicators; T encodes news event information; Y is the future
                load horizon.
              </p>
            </article>

            <article className="theory-card emphasis">
              <div className="comparison-icon">
                <SlidersHorizontal size={24} />
              </div>
              <h3>Counterfactual comparison</h3>
              <p>
                The target comparison changes the news treatment while holding
                the same historical operating context fixed.
              </p>
              <MathBlock
                expression={String.raw`\mu(T_{\mathrm{observed}},\mathbf{x})-\mu(T_0,\mathbf{x})`}
              />
              <p className="formula-note">
                This estimates news-related demand perturbations under observed
                versus alternative news conditions, such as a no-news reference
                treatment or an injected event scenario.
              </p>
            </article>

            <article className="theory-card">
              <div className="comparison-icon">
                <ShieldCheck size={24} />
              </div>
              <h3>Why balance is needed</h3>
              <p>
                A model trained only on factual outcomes may exploit confounded
                correlations. For example, high temperatures can both trigger
                weather-warning news and directly increase cooling demand.
              </p>
              <MathBlock
                expression={String.raw`\mathbf{Z}=\Phi(\mathbf{X}),\qquad T\leftarrow \mathbf{Z}\rightarrow Y`}
              />
              <p className="formula-note">
                NACF learns a confounder representation Z and reduces its
                distributional discrepancy across treatment-intensity groups.
              </p>
            </article>

            <article className="theory-card wide">
              <div className="comparison-icon">
                <BarChart3 size={24} />
              </div>
              <h3>Generalization bound for continuous treatments</h3>
              <p>
                The bound decomposes the unobservable counterfactual error into
                terms that can be controlled with observed data.
              </p>
              <MathBlock
                expression={String.raw`\epsilon(h)\leq \epsilon_w(h)+\mathrm{IPM}_{\Delta}(\Phi)+C_1\alpha\delta+C_0`}
              />
              <p className="formula-note">
                Weighted factual loss maps to learned sample reweighting;
                IPM_Δ(Φ) maps to MMD-based representation balance; the
                discretization term maps to treatment-intensity binning for
                continuous news treatments.
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="section" id="paper">
        <div className="section-inner">
          <div className="section-head">
            <div>
              <p className="section-kicker">Paper</p>
              <h2>Contributions</h2>
            </div>
            <p className="section-lede">
              The paper proposes the News-Aware Counterfactual Load Analysis
              Framework (NACF), treating news not merely as an auxiliary
              predictive signal but as a continuous semantic treatment that can
              be intervened on for counterfactual load analysis.
            </p>
          </div>
          <div className="metric-grid">
            <div className="stat">
              <strong>1</strong>
              <span>Counterfactual formulation for news-impact load analysis</span>
            </div>
            <div className="stat">
              <strong>2</strong>
              <span>Structured news-to-treatment pipeline using offline LLM extraction</span>
            </div>
            <div className="stat">
              <strong>3</strong>
              <span>Generalization-bound-guided architecture and training objective</span>
            </div>
            <div className="stat">
              <strong>4</strong>
              <span>Empirical validation for reliable counterfactual load analysis</span>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="method">
        <div className="section-inner">
          <div className="section-head">
            <div>
              <p className="section-kicker">NACF Method</p>
              <h2>News-Aware Counterfactual Load Analysis Framework</h2>
            </div>
            <p className="section-lede">
              Guided by the continuous-treatment bound, NACF converts raw news
              into structured event streams, learns confounder and treatment
              representations, and estimates treatment-dependent load
              trajectories with a varying-coefficient response network trained by
              weighted factual loss and IPM-based representation balance.
            </p>
          </div>

          <div className="two-col">
            <div className="method-flow">
              <div className="flow-step">
                <Search size={26} />
                <div>
                  <h3>LLM-structured event stream</h3>
                  <p>
                    An offline LLM-based extraction step converts unstructured
                    news articles into time-stamped event records with category,
                    temporal type, scope, relevance, and textual evidence.
                  </p>
                </div>
              </div>
              <div className="flow-step">
                <BrainCircuit size={26} />
                <div>
                  <h3>Confounder and treatment encoders</h3>
                  <p>
                    Historical load, meteorological variables, and calendar
                    indicators are encoded as the adjustment representation, while
                    the event stream is mapped into a continuous semantic
                    treatment space.
                  </p>
                </div>
              </div>
              <div className="flow-step">
                <ShieldCheck size={26} />
                <div>
                  <h3>Weighted factual loss and IPM balance</h3>
                  <p>
                    Learned sample reweighting controls the weighted factual
                    prediction term, while MMD-based balance regularization
                    reduces representation imbalance across treatment-intensity
                    groups.
                  </p>
                </div>
              </div>
              <div className="flow-step">
                <LineChart size={26} />
                <div>
                  <h3>Counterfactual load analysis</h3>
                  <p>
                    The response network generates factual and counterfactual
                    load trajectories under observed, removed, or injected news
                    treatments to estimate demand perturbations.
                  </p>
                </div>
              </div>
            </div>

            <div className="paper-figure">
              <div className="figure-frame">
                <img
                  src={assetPath("/figures/model_structure_diagram.png")}
                  alt="NACF model structure"
                />
              </div>
              <p className="figure-caption">
                Paper figure: overview of NACF, including structured event stream
                construction, model architecture, and counterfactual inference
                for load analysis.
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
              The website reuses figures from the manuscript and processed
              results. The key message is that NACF maintains strong factual
              forecasting performance while providing evidence of
              treatment-intensity structure, improved representation balance, and
              interpretable news-related demand perturbations.
            </p>
          </div>
          <div className="results-grid">
            <article className="figure-tile">
              <img src={assetPath("/figures/category_perturbations.png")} alt="Category-specific perturbations" />
              <h3>Category-specific perturbations</h3>
              <p>
                News effects are aggregated by category using absolute CATE and
                ITE distributions, showing heterogeneous impacts across
                environmental, social, economic, and grid events.
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
                The learned treatment representation preserves a graded notion
                of semantic departure from the no-news reference baseline.
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
              This panel follows the tutorial notebook: observed-news prediction,
              reference-treatment counterfactual prediction, and custom-news
              scenario prediction for the same historical operating context.
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
              Paper figure: factual forecast, reference-treatment counterfactual
              forecast, true future load, net perturbation, and representative
              high-relevance news signals in the same historical window.
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
