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
import { InvoiceDialog } from "../components/InvoiceDialog";
import { AXIS_TICK, COLORS, TOOLTIP_STYLE } from "../theme";
import type { Item, Party, Txn } from "../types";

interface Props {
  kind: "purchase" | "sale";
}

interface LineDraft {
  item_id: string;
  qty: string;
  price: string;
}

const CFG = {
  purchase: {
    title: "Purchases",
    singular: "purchase",
    endpoint: "/purchases",
    partyKind: "supplier" as const,
    partyLabel: "Supplier",
    priceLabel: "Cost per unit",
    eyebrow: "Stock in",
    icon: "cart" as const,
    color: COLORS.amber,
    blurb:
      "Buy stock from suppliers. Stock rises and the average cost is updated.",
    useItemPrice: (it: Item) => it.unit_cost,
  },
  sale: {
    title: "Sales",
    singular: "sale",
    endpoint: "/sales",
    partyKind: "customer" as const,
    partyLabel: "Customer",
    priceLabel: "Price per unit",
    eyebrow: "Stock out",
    icon: "receipt" as const,
    color: COLORS.teal,
    blurb:
      "Sell to customers. Stock falls, and the cost of goods sold is recorded for profit.",
    useItemPrice: (it: Item) => it.unit_price,
  },
};

const emptyLine = (): LineDraft => ({ item_id: "", qty: "1", price: "" });

export default function Transactions({ kind }: Props) {
  const cfg = CFG[kind];
  const parties = useApi<Party[]>(`/parties?kind=${cfg.partyKind}`, []);
  const items = useApi<Item[]>("/items", []);
  const txns = useApi<Txn[]>(cfg.endpoint, []);
  const { settings } = useSettings();
  const cur = settings.currency ?? "₹";

  const [party, setParty] = useState("");
  const [date, setDate] = useState(todayYmd());
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [msg, setMsg] = useState<Msg>(null);
  const [invoiceFor, setInvoiceFor] = useState<Txn | null>(null);

  const setLine = (i: number, patch: Partial<LineDraft>) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const pickItem = (i: number, itemId: string) => {
    const it = items.data.find((x) => String(x.id) === itemId);
    setLine(i, {
      item_id: itemId,
      price: it ? String(cfg.useItemPrice(it)) : "",
    });
  };

  const total = lines.reduce(
    (a, l) => a + (Number(l.qty) || 0) * (Number(l.price) || 0),
    0,
  );
  const grand = txns.data.reduce((a, t) => a + t.total, 0);

  const reset = () => {
    setParty("");
    setState("");
    setCity("");
    setDate(todayYmd());
    setLines([emptyLine()]);
  };

  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const body = {
      party_id: Number(party),
      date,
      state,
      city,
      lines: lines
        .filter((l) => l.item_id)
        .map((l) => ({
          item_id: Number(l.item_id),
          qty: Number(l.qty),
          price: Number(l.price) || 0,
        })),
    };
    try {
      await request(cfg.endpoint, "POST", body);
      setMsg({
        type: "success",
        text: `${cfg.singular[0].toUpperCase()}${cfg.singular.slice(1)} saved and stock updated`,
      });
      reset();
      txns.reload();
      items.reload();
    } catch (err) {
      setMsg({ type: "danger", text: (err as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (t: Txn) => {
    if (
      !window.confirm(
        `Delete ${cfg.singular} #${t.id}? Stock will be reversed.`,
      )
    )
      return;
    try {
      await request(`${cfg.endpoint}/${t.id}`, "DELETE");
      txns.reload();
      items.reload();
    } catch (err) {
      setMsg({ type: "danger", text: (err as Error).message });
    }
  };

  const monthly = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of txns.data) {
      const k = t.date.slice(0, 7);
      m.set(k, (m.get(k) ?? 0) + t.total);
    }
    return [...m.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-12)
      .map(([month, value]) => ({ month, value: Math.round(value) }));
  }, [txns.data]);

  const columns: Column<Txn>[] = [
    {
      key: "id",
      header: "#",
      render: (t) => <span className="text-muted">{t.id}</span>,
    },
    { key: "date", header: "Date", render: (t) => dayLabel(t.date) },
    {
      key: "party",
      header: cfg.partyLabel,
      render: (t) => (
        <>
          <div className="cell-main">{t.party_name}</div>
          <div className="cell-sub">
            {[t.city, t.state].filter(Boolean).join(", ") || "No location"}
          </div>
        </>
      ),
    },
    {
      key: "lines",
      header: "Lines",
      align: "center",
      render: (t) => <span className="chip chip-neutral">{t.lines}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "end",
      render: (t) => <span className="amount">{money(t.total, cur)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (t) => (
        <div className="d-inline-flex align-items-center gap-2">
          {kind === "sale" && (
            <button
              type="button"
              className="btn btn-outline-dark btn-sm"
              onClick={() => setInvoiceFor(t)}
            >
              <Icon name="receipt" size={13} /> Invoice
            </button>
          )}
          <button
            className="icon-btn danger"
            type="button"
            aria-label={`Delete ${cfg.singular} ${t.id}`}
            onClick={() => remove(t)}
          >
            <Icon name="trash" size={14} />
          </button>
        </div>
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
            value={txns.data.length}
            accent={cfg.color}
            icon={cfg.icon}
            delay={0}
          />
        </div>
        <div className="col-6 col-xl-4">
          <Stat
            label="Total value"
            value={money(grand, cur)}
            accent={COLORS.navy}
            icon="coins"
            delay={80}
          />
        </div>
        <div className="col-12 col-xl-4">
          <Stat
            label={`${cfg.partyLabel}s on file`}
            value={parties.data.length}
            accent={COLORS.sky}
            icon="users"
            delay={160}
          />
        </div>
      </div>

      <div className="row g-4 align-items-start">
        <div className="col-12 col-xl-5">
          <Card
            title={`New ${cfg.singular}`}
            subtitle="Add items and quantities. Stock is checked before saving."
            delay={120}
          >
            <Notice msg={msg} />
            <form onSubmit={save} className="row g-3">
              <div className="col-12">
                <Field id="party" label={cfg.partyLabel}>
                  <select
                    id="party"
                    className="form-select"
                    required
                    value={party}
                    onChange={(e) => setParty(e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {parties.data.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="col-12 col-sm-4">
                <Field id="tdate" label="Date">
                  <input
                    id="tdate"
                    type="date"
                    className="form-control"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </Field>
              </div>
              <div className="col-6 col-sm-4">
                <Field id="state" label="State">
                  <input
                    id="state"
                    className="form-control"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                  />
                </Field>
              </div>
              <div className="col-6 col-sm-4">
                <Field id="tcity" label="City">
                  <input
                    id="tcity"
                    className="form-control"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                  />
                </Field>
              </div>

              <div className="col-12">
                <div className="field-label mb-2">Items</div>
                <div className="d-grid gap-2">
                  {lines.map((l, i) => (
                    <div className="line-row" key={i}>
                      <select
                        className="form-select"
                        aria-label={`Item for line ${i + 1}`}
                        value={l.item_id}
                        onChange={(e) => pickItem(i, e.target.value)}
                      >
                        <option value="">Item…</option>
                        {items.data.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} ({it.qty} in stock)
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={1}
                        className="form-control"
                        aria-label={`Quantity for line ${i + 1}`}
                        value={l.qty}
                        onChange={(e) => setLine(i, { qty: e.target.value })}
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="form-control"
                        aria-label={`${cfg.priceLabel} for line ${i + 1}`}
                        placeholder={cfg.priceLabel}
                        value={l.price}
                        onChange={(e) => setLine(i, { price: e.target.value })}
                      />
                      <div className="line-del">
                        {lines.length > 1 && (
                          <button
                            type="button"
                            className="icon-btn danger"
                            aria-label={`Remove line ${i + 1}`}
                            onClick={() =>
                              setLines(lines.filter((_, idx) => idx !== i))
                            }
                          >
                            <Icon name="trash" size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-outline-dark btn-sm mt-2"
                  onClick={() => setLines([...lines, emptyLine()])}
                >
                  <Icon name="plus" size={13} /> Add line
                </button>
              </div>

              <div className="col-12">
                <div className="total-bar">
                  <div>
                    <div className="label">Total</div>
                    <div className="value">{money(total, cur)}</div>
                  </div>
                  <button
                    className="btn btn-amber px-4"
                    type="submit"
                    disabled={busy}
                  >
                    {busy && <MorphLoader />}
                    Save {cfg.singular}
                  </button>
                </div>
              </div>
            </form>
          </Card>
        </div>

        <div className="col-12 col-xl-7">
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
            <Card
              title={`Recent ${cfg.title.toLowerCase()}`}
              subtitle="Deleting one reverses its stock movement."
              delay={240}
            >
              <DataTable
                rows={txns.data}
                columns={columns}
                rowKey={(t) => t.id}
                empty={`Nothing recorded yet. Save your first ${cfg.singular} on the left.`}
                emptyIcon={cfg.icon}
                minWidth={680}
              />
            </Card>
          </div>
        </div>
      </div>
      {invoiceFor && (
        <InvoiceDialog
          txn={invoiceFor}
          currency={cur}
          defaultEmail={
            parties.data.find((p) => p.id === invoiceFor.party_id)?.email ?? ""
          }
          onClose={() => setInvoiceFor(null)}
        />
      )}
    </>
  );
}
