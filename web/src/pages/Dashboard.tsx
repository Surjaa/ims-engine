import type { CSSProperties, ReactNode } from "react";
import { MorphLoader } from "../components/MorphLoader";
import {
  Area,
  AreaChart,
  Bar as ChartBar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend as RLegend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useApi } from "../api";
import { useSettings } from "../context";
import { EMPTY_DASHBOARD, compact, dayLabel, money, todayYmd } from "../lib";
import type { DashboardData, NameValue } from "../types";

const PALETTE = [
  "#0891B2",
  "#0F172A",
  "#0891B2",
  "#F59E0B",
  "#6366F1",
  "#F97316",
  "#6366F1",
  "#94A3B8",
];
const TOOLTIP_STYLE: CSSProperties = {
  borderRadius: 14,
  border: "1px solid #CBD5E1",
  boxShadow: "0 12px 30px rgba(1, 11, 19, .15)",
  fontSize: 13,
};
const AXIS_TICK = { fontSize: 12, fill: "#64748B" };

const KPI_ICONS = ["↗", "↙", "✦", "⬇", "⬆", "◉", "◆"];

function ChartCard({
  title,
  sub,
  children,
  className = "",
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`chart-card ${className}`}>
      <div className="card-head">
        <h3 className="card-title">{title}</h3>
        {sub && <p className="card-sub">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  icon,
  delay,
}: {
  label: string;
  value: string;
  accent: string;
  icon: string;
  delay: number;
}) {
  return (
    <div
      className="kpi-card"
      style={
        {
          "--kpi-accent": accent,
          animationDelay: `${delay}ms`,
        } as CSSProperties
      }
    >
      <div className="d-flex justify-content-between align-items-start gap-2">
        <span className="kpi-label">{label}</span>
        <span className="kpi-icon" aria-hidden>
          {icon}
        </span>
      </div>
      <div className="kpi-value">{value}</div>
    </div>
  );
}

function Empty() {
  return <div className="empty-state">No data yet</div>;
}

function LegendList({ data, total }: { data: NameValue[]; total: number }) {
  return (
    <ul className="legend-list">
      {data.map((d, i) => (
        <li key={d.name}>
          <span
            className="legend-dot"
            style={{ background: PALETTE[i % PALETTE.length] }}
          />
          <span className="legend-name">{d.name}</span>
          <span className="legend-pct">
            {total > 0 ? Math.round((d.value / total) * 100) : 0}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function Donut({ data, currency }: { data: NameValue[]; currency: string }) {
  if (!data.length) return <Empty />;
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <>
      <div className="donut-wrap">
        <ResponsiveContainer width="100%" height={230}>
          <PieChart>
            <Pie
              isAnimationActive={false}
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={68}
              outerRadius={100}
              paddingAngle={3}
              cornerRadius={6}
              stroke="none"
              animationDuration={900}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v) => money(Number(v), currency)}
              contentStyle={TOOLTIP_STYLE}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-center">
          <span className="donut-label">Total</span>
          <span className="donut-value">{compact(total)}</span>
        </div>
      </div>
      <LegendList data={data} total={total} />
    </>
  );
}

function HBars({ data, currency }: { data: NameValue[]; currency: string }) {
  if (!data.length) return <Empty />;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="hbar-list">
      {data.map((d, i) => (
        <li key={d.name}>
          <div className="hbar-top">
            <span title={d.name}>{d.name}</span>
            <strong>{money(d.value, currency)}</strong>
          </div>
          <div className="hbar-track">
            <div
              className="hbar-fill"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: `linear-gradient(90deg, ${PALETTE[i % PALETTE.length]}, ${PALETTE[(i + 2) % PALETTE.length]})`,
                animationDelay: `${i * 70}ms`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const {
    data: d,
    error,
    loading,
  } = useApi<DashboardData>("/dashboard", EMPTY_DASHBOARD);
  const { settings } = useSettings();
  const cur = settings.currency ?? "₹";
  const company = settings.company_name ?? "IMS";
  const k = d.kpis;

  const kpis: { label: string; value: string }[] = [
    { label: "Total Sales", value: money(k.total_sales, cur) },
    { label: "Total Purchases", value: money(k.total_purchases, cur) },
    { label: "Net Profit", value: money(k.net_profit, cur) },
    { label: "Total Receivable", value: money(k.receivable, cur) },
    { label: "Total Payable", value: money(k.payable, cur) },
    { label: "Top Sales Location", value: k.top_location ?? "—" },
    { label: "Top Selling Item", value: k.top_item ?? "—" },
  ];
  const accents = [
    "#0891B2",
    "#6366F1",
    "#0891B2",
    "#F59E0B",
    "#F97316",
    "#6366F1",
    "#0F172A",
  ];

  return (
    <>
      <section className="container pt-4 pt-md-5">
        <div className="hero">
          <span className="hero-pill">Key trends and business insights</span>
          <h1>Dashboard</h1>
          <p className="hero-sub">
            {company} · {dayLabel(todayYmd())}
          </p>
          {error && <div className="alert alert-danger mt-3 mb-0">{error}</div>}
          {loading && (
            <p className="small mt-3 mb-0 opacity-75 d-inline-flex align-items-center gap-2">
              <MorphLoader size={16} /> Loading…
            </p>
          )}
        </div>
      </section>

      <section className="container py-4">
        <div className="row g-3">
          {kpis.map((kpi, i) => (
            <div key={kpi.label} className="col-6 col-md-4 col-xl-3">
              <Kpi
                label={kpi.label}
                value={kpi.value}
                accent={accents[i]}
                icon={KPI_ICONS[i]}
                delay={i * 60}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="container pb-5">
        <div className="row g-3">
          <div className="col-12 col-xl-8">
            <ChartCard title="Sales Trend" sub="Last 12 months">
              {d.salesTrend.length ? (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart
                    data={d.salesTrend}
                    margin={{ top: 10, right: 12, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#0891B2"
                          stopOpacity={0.45}
                        />
                        <stop
                          offset="100%"
                          stopColor="#0891B2"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="#E2E8F0"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => compact(Number(v))}
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip
                      formatter={(v) => money(Number(v), cur)}
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ stroke: "#0891B2", strokeOpacity: 0.3 }}
                    />
                    <Area
                      isAnimationActive={false}
                      type="monotone"
                      dataKey="sales"
                      name="Sales"
                      stroke="#0891B2"
                      strokeWidth={3}
                      fill="url(#gSales)"
                      dot={{
                        r: 3.5,
                        fill: "#fff",
                        stroke: "#0891B2",
                        strokeWidth: 2,
                      }}
                      activeDot={{ r: 7 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Empty />
              )}
            </ChartCard>
          </div>

          <div className="col-12 col-xl-4">
            <ChartCard title="Top Customers" sub="By sales value">
              <HBars
                data={d.topCustomers.map((c) => ({
                  name: c.name,
                  value: c.total,
                }))}
                currency={cur}
              />
            </ChartCard>
          </div>

          <div className="col-12 col-md-6 col-xl-4">
            <ChartCard
              title="Purchase by Location"
              sub="Share of purchase value"
            >
              <Donut data={d.purchaseByLocation} currency={cur} />
            </ChartCard>
          </div>

          <div className="col-12 col-xl-8">
            <ChartCard
              title="Purchase by Category"
              sub="Yearly, stacked by category"
            >
              {d.purchaseByCategory.rows.length ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart
                    data={d.purchaseByCategory.rows}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="#E2E8F0"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="year"
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => compact(Number(v))}
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip
                      formatter={(v) => money(Number(v), cur)}
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ fill: "rgba(1,11,19,.04)" }}
                    />
                    <RLegend
                      iconType="circle"
                      wrapperStyle={{ fontSize: 12 }}
                    />
                    {d.purchaseByCategory.categories.map((c, i) => (
                      <ChartBar
                        key={c}
                        dataKey={c}
                        stackId="a"
                        fill={PALETTE[i % PALETTE.length]}
                        radius={
                          i === d.purchaseByCategory.categories.length - 1
                            ? [6, 6, 0, 0]
                            : 0
                        }
                        animationDuration={900}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty />
              )}
            </ChartCard>
          </div>

          <div className="col-12 col-md-6 col-xl-4">
            <ChartCard title="Sales by Location" sub="Sales value per state">
              {d.salesByLocation.length ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={d.salesByLocation}
                    margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="#E2E8F0"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="name"
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => compact(Number(v))}
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      width={56}
                    />
                    <Tooltip
                      formatter={(v) => money(Number(v), cur)}
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ fill: "rgba(1,11,19,.04)" }}
                    />
                    <ChartBar
                      dataKey="value"
                      name="Sales"
                      radius={[8, 8, 0, 0]}
                      animationDuration={900}
                    >
                      {d.salesByLocation.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </ChartBar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Empty />
              )}
            </ChartCard>
          </div>

          <div className="col-12 col-md-6 col-xl-4">
            <ChartCard title="Sales by Category" sub="Share of sales value">
              <Donut data={d.salesByCategory} currency={cur} />
            </ChartCard>
          </div>

          <div className="col-12 col-xl-4">
            <ChartCard title="Sales by City" sub="Ranked by sales value">
              <HBars data={d.salesByCity} currency={cur} />
            </ChartCard>
          </div>
        </div>
      </section>
    </>
  );
}
