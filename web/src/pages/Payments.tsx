import { useMemo, useState, type FormEvent } from "react";
import { MorphLoader } from "../components/MorphLoader";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { request, useApi } from "../api";
import {
  Card,
  type Column,
  DataTable,
  Field,
  Icon,
  Notice,
  PageHeader,
  Stat,
  type Msg,
} from "../components/kit";
import { useSettings } from "../context";
import { compact, dayLabel, money, todayYmd } from "../lib";
import { AXIS_TICK, COLORS, TOOLTIP_STYLE } from "../theme";
import type { Party, Payment } from "../types";

interface Props {
  direction: "receipt" | "payment";
}

const CFG = {
  receipt: {
    title: "Receipts",
    singular: "receipt",
    partyKind: "customer",
    partyLabel: "Received from",
    eyebrow: "Money in",
    icon: "coins" as const,
    color: COLORS.teal,
    blurb:
      "Record money received from customers. It reduces what they owe you.",
  },
  payment: {
    title: "Payments",
    singular: "payment",
    partyKind: "supplier",
    partyLabel: "Paid to",
    eyebrow: "Money out",
    icon: "coins" as const,
    color: COLORS.amber,
    blurb: "Record money paid to suppliers. It reduces what you owe them.",
  },
};

export default function Payments({ direction }: Props) {
  const cfg = CFG[direction];
  const parties = useApi<Party[]>(`/parties?kind=${cfg.partyKind}`, []);
  const list = useApi<Payment[]>(`/payments?direction=${direction}`, []);
  const { settings } = useSettings();
  const cur = settings.currency ?? "₹";

  const [party, setParty] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayYmd());
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await request("/payments", "POST", {
        direction,
        party_id: Number(party),
        amount: Number(amount),
        date,
        note,
      });
      setMsg({
        type: "success",
        text: `${cfg.singular[0].toUpperCase()}${cfg.singular.slice(1)} recorded`,
      });
      setParty("");
      setAmount("");
      setNote("");
      setDate(todayYmd());
      list.reload();
      parties.reload();
    } catch (err) {
      setMsg({ type: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (p: Payment) => {
    if (
      !window.confirm(`Delete this ${cfg.singular} of ${money(p.amount, cur)}?`)
    )
      return;
    try {
      await request(`/payments/${p.id}`, "DELETE");
      list.reload();
    } catch (err) {
      setMsg({ type: "danger", text: (err as Error).message });
    }
  };

  const total = list.data.reduce((a, p) => a + p.amount, 0);

  const monthly = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of list.data) {
      const k = p.date.slice(0, 7);
      m.set(k, (m.get(k) ?? 0) + p.amount);
    }
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, value]) => ({ month, value: Math.round(value) }));
  }, [list.data]);

  const columns: Column<Payment>[] = [
    { key: "date", header: "Date", render: (p) => dayLabel(p.date) },
    {
      key: "party",
      header: cfg.partyLabel,
      render: (p) => (
        <>
          <div className="cell-main">{p.party_name}</div>
          <div className="cell-sub">{p.note || "No note"}</div>
        </>
      ),
    },
    {
      key: "amount",
      header: "Amount",
      align: "end",
      render: (p) => <span className="amount">{money(p.amount, cur)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (p) => (
        <button
          className="icon-btn danger"
          type="button"
          aria-label={`Delete ${cfg.singular}`}
          onClick={() => remove(p)}
        >
          <Icon name="trash" size={14} />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        icon={cfg.icon}
        eyebrow={cfg.eyebrow}
        title={cfg.title}
        subtitle={cfg.blurb}
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-4">
          <Stat
            label={`${cfg.title} recorded`}
            value={list.data.length}
            accent={cfg.color}
            icon={cfg.icon}
            delay={0}
          />
        </div>
        <div className="col-6 col-xl-4">
          <Stat
            label="Total amount"
            value={money(total, cur)}
            accent={COLORS.navy}
            icon="coins"
            delay={80}
          />
        </div>
        <div className="col-12 col-xl-4">
          <Stat
            label="Parties"
            value={parties.data.length}
            accent={COLORS.sky}
            icon="users"
            delay={160}
          />
        </div>
      </div>

      <div className="row g-4 align-items-start">
        <div className="col-12 col-lg-5">
          <Card title={`New ${cfg.singular}`} delay={120}>
            <Notice msg={msg} />
            <form onSubmit={save} className="row g-3">
              <div className="col-12">
                <Field id="pparty" label={cfg.partyLabel}>
                  <select
                    id="pparty"
                    className="form-select"
                    required
                    value={party}
                    onChange={(e) => setParty(e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {parties.data.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (balance {money(p.balance, cur)})
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="col-6">
                <Field id="pamount" label="Amount">
                  <input
                    id="pamount"
                    type="number"
                    min={0.01}
                    step="0.01"
                    required
                    className="form-control"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
              </div>
              <div className="col-6">
                <Field id="pdate" label="Date">
                  <input
                    id="pdate"
                    type="date"
                    className="form-control"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
              </div>
              <div className="col-12">
                <Field id="pnote" label="Note">
                  <input
                    id="pnote"
                    className="form-control"
                    placeholder="Optional reference or remark"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>
              </div>
              <div className="col-12">
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={busy}
                >
                  {busy && <MorphLoader />}
                  <Icon name="plus" size={15} /> Save {cfg.singular}
                </button>
              </div>
            </form>
          </Card>
        </div>

        <div className="col-12 col-lg-7">
          <Card
            title={`${cfg.title} by month`}
            subtitle="Last 12 months with activity."
            delay={180}
          >
            {monthly.length ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={monthly}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
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
                    width={52}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v) => money(Number(v), cur)}
                    cursor={{ fill: "rgba(15, 23, 42,.04)" }}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="value"
                    fill={cfg.color}
                    radius={[8, 8, 0, 0]}
                    animationDuration={800}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted small mb-0">
                Nothing recorded yet, so no chart to show.
              </p>
            )}
          </Card>

          <div className="mt-4">
            <Card title={`Recent ${cfg.title.toLowerCase()}`} delay={240}>
              <DataTable
                rows={list.data}
                columns={columns}
                rowKey={(p) => p.id}
                empty={`Nothing recorded yet. Save your first ${cfg.singular} on the left.`}
                emptyIcon="coins"
                minWidth={520}
              />
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
