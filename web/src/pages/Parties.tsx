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
  Avatar,
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
import { money, compact } from "../lib";
import { AXIS_TICK, COLORS, TOOLTIP_STYLE } from "../theme";
import type { Party } from "../types";

interface Props {
  kind: "supplier" | "customer";
}

const COPY = {
  supplier: {
    title: "Suppliers",
    singular: "supplier",
    eyebrow: "Accounts payable",
    icon: "cart" as const,
    balanceLabel: "We owe",
    blurb:
      "Vendors you buy stock from. The balance is what you still owe them.",
    color: COLORS.amber,
  },
  customer: {
    title: "Customers",
    singular: "customer",
    eyebrow: "Accounts receivable",
    icon: "users" as const,
    balanceLabel: "Owes us",
    blurb: "Buyers you sell to. The balance is what they still owe you.",
    color: COLORS.teal,
  },
};

const BLANK = { name: "", phone: "", email: "", city: "" };

export default function Parties({ kind }: Props) {
  const copy = COPY[kind];
  const list = useApi<Party[]>(`/parties?kind=${kind}`, []);
  const { settings } = useSettings();
  const cur = settings.currency ?? "₹";

  const [form, setForm] = useState(BLANK);
  const [editId, setEditId] = useState<number | null>(null);
  const [msg, setMsg] = useState<Msg>(null);

  const fail = (err: unknown) =>
    setMsg({ type: "danger", text: (err as Error).message });
  const cancel = () => {
    setEditId(null);
    setForm(BLANK);
  };

  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (editId) await request(`/parties/${editId}`, "PUT", { ...form, kind });
      else await request("/parties", "POST", { ...form, kind });
      setMsg({
        type: "success",
        text: editId
          ? "Saved"
          : `${copy.singular[0].toUpperCase()}${copy.singular.slice(1)} added`,
      });
      cancel();
      list.reload();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const edit = (p: Party) => {
    setEditId(p.id);
    setForm({ name: p.name, phone: p.phone, email: p.email, city: p.city });
  };

  const remove = async (p: Party) => {
    if (!window.confirm(`Delete ${p.name}?`)) return;
    try {
      await request(`/parties/${p.id}`, "DELETE");
      list.reload();
    } catch (err) {
      fail(err);
    }
  };

  const fields: { key: keyof typeof BLANK; label: string; type?: string }[] = [
    { key: "name", label: "Name" },
    { key: "phone", label: "Phone", type: "tel" },
    { key: "email", label: "Email", type: "email" },
    { key: "city", label: "City" },
  ];

  const total = list.data.reduce((a, p) => a + p.balance, 0);
  const withBalance = list.data.filter((p) => p.balance !== 0).length;

  const chart = useMemo(
    () =>
      [...list.data]
        .filter((p) => p.balance !== 0)
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10)
        .map((p) => ({ name: p.name, balance: Math.round(p.balance) })),
    [list.data],
  );

  const columns: Column<Party>[] = [
    {
      key: "name",
      header: "Name",
      render: (p) => (
        <div className="d-flex align-items-center gap-2">
          <Avatar name={p.name} size={32} />
          <div>
            <div className="cell-main">{p.name}</div>
            <div className="cell-sub">{p.city || "No city"}</div>
          </div>
        </div>
      ),
    },
    {
      key: "phone",
      header: "Phone",
      render: (p) => p.phone || <span className="text-muted">—</span>,
    },
    {
      key: "email",
      header: "Email",
      render: (p) => p.email || <span className="text-muted">—</span>,
    },
    {
      key: "balance",
      header: copy.balanceLabel,
      align: "end",
      render: (p) => (
        <span
          className={`amount ${p.balance > 0 ? (kind === "customer" ? "amount-pos" : "amount-neg") : ""}`}
        >
          {money(p.balance, cur)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (p) => (
        <div className="cell-actions">
          <button
            className="icon-btn"
            type="button"
            aria-label={`Edit ${p.name}`}
            onClick={() => edit(p)}
          >
            <Icon name="edit" size={14} />
          </button>
          <button
            className="icon-btn danger"
            type="button"
            aria-label={`Delete ${p.name}`}
            onClick={() => remove(p)}
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
        icon={copy.icon}
        eyebrow={copy.eyebrow}
        title={copy.title}
        subtitle={copy.blurb}
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-4">
          <Stat
            label={`Total ${copy.title.toLowerCase()}`}
            value={list.data.length}
            accent={copy.color}
            icon={copy.icon}
            delay={0}
          />
        </div>
        <div className="col-6 col-xl-4">
          <Stat
            label={`${copy.balanceLabel} (total)`}
            value={money(total, cur)}
            accent={COLORS.navy}
            icon="coins"
            delay={80}
          />
        </div>
        <div className="col-12 col-xl-4">
          <Stat
            label="With an open balance"
            value={withBalance}
            accent={COLORS.sky}
            icon="users"
            hint="Balances not yet settled"
            delay={160}
          />
        </div>
      </div>

      <div className="row g-4 align-items-start">
        <div className="col-12 col-xl-4">
          <Card
            title={`${editId ? "Edit" : "New"} ${copy.singular}`}
            subtitle="Balances update automatically from transactions and payments."
            delay={120}
          >
            <Notice msg={msg} />
            <form onSubmit={save} className="row g-3">
              {fields.map((f) => (
                <div className="col-12" key={f.key}>
                  <Field id={`p-${f.key}`} label={f.label}>
                    <input
                      id={`p-${f.key}`}
                      type={f.type ?? "text"}
                      className="form-control"
                      required={f.key === "name"}
                      value={form[f.key]}
                      onChange={(e) =>
                        setForm({ ...form, [f.key]: e.target.value })
                      }
                    />
                  </Field>
                </div>
              ))}
              <div className="col-12 d-flex gap-2">
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={busy}
                >
                  {busy && <MorphLoader />}
                  <Icon name={editId ? "check" : "plus"} size={15} />{" "}
                  {editId ? "Save" : "Add"}
                </button>
                {editId && (
                  <button
                    className="btn btn-outline-dark"
                    type="button"
                    onClick={cancel}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </Card>
        </div>

        <div className="col-12 col-xl-8">
          <Card
            title={copy.balanceLabel}
            subtitle="Largest open balances first."
            delay={180}
          >
            {chart.length ? (
              <ResponsiveContainer
                width="100%"
                height={Math.max(180, chart.length * 38 + 30)}
              >
                <BarChart
                  data={chart}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 4, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke="#E2E8F0"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => compact(Number(v))}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={140}
                    tick={AXIS_TICK}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(v) => money(Number(v), cur)}
                    cursor={{ fill: "rgba(15, 23, 42,.04)" }}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="balance"
                    fill={copy.color}
                    radius={[0, 8, 8, 0]}
                    animationDuration={800}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted small mb-0">
                No open balances right now.
              </p>
            )}
          </Card>

          <div className="mt-4">
            <Card
              title={`All ${copy.title.toLowerCase()} (${list.data.length})`}
              delay={240}
            >
              <DataTable
                rows={list.data}
                columns={columns}
                rowKey={(p) => p.id}
                empty={`No ${copy.title.toLowerCase()} yet. Add one on the left.`}
                emptyIcon={copy.icon}
                minWidth={760}
              />
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
