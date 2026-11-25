import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { MorphLoader } from "../components/MorphLoader";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  Sku,
  Stat,
  StatusChip,
  type Msg,
} from "../components/kit";
import { useSettings } from "../context";
import { money } from "../lib";
import { AXIS_TICK, COLORS, PALETTE, TOOLTIP_STYLE } from "../theme";
import type { Category, CustomField, Item } from "../types";

type TextKey =
  | "sku"
  | "name"
  | "category_id"
  | "unit"
  | "qty"
  | "reorder_level"
  | "unit_cost"
  | "unit_price";

interface Draft {
  sku: string;
  name: string;
  category_id: string;
  unit: string;
  qty: string;
  reorder_level: string;
  unit_cost: string;
  unit_price: string;
  extra: Record<string, string>;
}

const BLANK: Draft = {
  sku: "",
  name: "",
  category_id: "",
  unit: "pcs",
  qty: "0",
  reorder_level: "0",
  unit_cost: "0",
  unit_price: "0",
  extra: {},
};

export default function Catalogs() {
  const cats = useApi<Category[]>("/categories", []);
  const fields = useApi<CustomField[]>("/fields", []);
  const items = useApi<Item[]>("/items", []);
  const { settings } = useSettings();
  const cur = settings.currency ?? "₹";

  const [draft, setDraft] = useState<Draft>(BLANK);
  const [editId, setEditId] = useState<number | null>(null);
  const [newCat, setNewCat] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  const set =
    (k: TextKey) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setDraft({ ...draft, [k]: e.target.value });
  const setExtra = (key: string, value: string) =>
    setDraft({ ...draft, extra: { ...draft.extra, [key]: value } });
  const fail = (err: unknown) =>
    setMsg({ type: "danger", text: (err as Error).message });

  const startEdit = (it: Item) => {
    setEditId(it.id);
    setDraft({
      sku: it.sku,
      name: it.name,
      category_id: it.category_id ? String(it.category_id) : "",
      unit: it.unit,
      qty: String(it.qty),
      reorder_level: String(it.reorder_level),
      unit_cost: String(it.unit_cost),
      unit_price: String(it.unit_price),
      extra: { ...it.extra },
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancel = () => {
    setEditId(null);
    setDraft(BLANK);
  };

  const [busy, setBusy] = useState(false);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const body = {
      sku: draft.sku,
      name: draft.name,
      category_id: draft.category_id ? Number(draft.category_id) : null,
      unit: draft.unit,
      reorder_level: Number(draft.reorder_level) || 0,
      unit_cost: Number(draft.unit_cost) || 0,
      unit_price: Number(draft.unit_price) || 0,
      extra: draft.extra,
    };
    try {
      if (editId) await request(`/items/${editId}`, "PUT", body);
      else
        await request("/items", "POST", {
          ...body,
          qty: Number(draft.qty) || 0,
        });
      setMsg({ type: "success", text: editId ? "Item updated" : "Item added" });
      cancel();
      items.reload();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (it: Item) => {
    if (!window.confirm(`Delete ${it.name}?`)) return;
    try {
      await request(`/items/${it.id}`, "DELETE");
      if (editId === it.id) cancel();
      items.reload();
    } catch (err) {
      fail(err);
    }
  };

  const [catBusy, setCatBusy] = useState(false);
  const addCategory = async (e: FormEvent) => {
    e.preventDefault();
    if (!newCat.trim()) return;
    setCatBusy(true);
    try {
      await request("/categories", "POST", { name: newCat });
      setNewCat("");
      cats.reload();
    } catch (err) {
      fail(err);
    } finally {
      setCatBusy(false);
    }
  };

  const stockValue = items.data.reduce((a, i) => a + i.qty * i.unit_cost, 0);

  const valueByCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items.data) {
      const k = i.category ?? "Uncategorized";
      m.set(k, (m.get(k) ?? 0) + i.qty * i.unit_cost);
    }
    return [...m.entries()]
      .map(([name, value]) => ({ name, value: Math.round(value) }))
      .sort((a, b) => b.value - a.value);
  }, [items.data]);

  const columns: Column<Item>[] = [
    {
      key: "name",
      header: "Item",
      render: (it) => (
        <>
          <div className="cell-main">{it.name}</div>
          <div className="cell-sub">
            {it.category ?? "Uncategorized"} · {it.unit}
          </div>
        </>
      ),
    },
    { key: "sku", header: "SKU", render: (it) => <Sku>{it.sku}</Sku> },
    {
      key: "qty",
      header: "Qty",
      align: "end",
      render: (it) => <span className="amount">{it.qty}</span>,
    },
    {
      key: "cost",
      header: "Cost",
      align: "end",
      render: (it) => money(it.unit_cost, cur),
    },
    {
      key: "price",
      header: "Price",
      align: "end",
      render: (it) => money(it.unit_price, cur),
    },
    {
      key: "status",
      header: "Status",
      render: (it) => <StatusChip item={it} />,
    },
    {
      key: "actions",
      header: "",
      align: "end",
      render: (it) => (
        <div className="cell-actions">
          <button
            className="icon-btn"
            type="button"
            aria-label={`Edit ${it.name}`}
            onClick={() => startEdit(it)}
          >
            <Icon name="edit" size={14} />
          </button>
          <button
            className="icon-btn danger"
            type="button"
            aria-label={`Delete ${it.name}`}
            onClick={() => remove(it)}
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
        icon="stack"
        eyebrow="Master data"
        title="Catalogs"
        subtitle="Your products, prices, categories and the custom fields you define."
      />

      <div className="row g-3 mb-4">
        <div className="col-6 col-xl-3">
          <Stat
            label="Items"
            value={items.data.length}
            accent={COLORS.teal}
            icon="box"
            delay={0}
          />
        </div>
        <div className="col-6 col-xl-3">
          <Stat
            label="Categories"
            value={cats.data.length}
            accent={COLORS.navy}
            icon="stack"
            delay={60}
          />
        </div>
        <div className="col-6 col-xl-3">
          <Stat
            label="Custom fields"
            value={fields.data.length}
            accent={COLORS.amber}
            icon="cog"
            delay={120}
          />
        </div>
        <div className="col-6 col-xl-3">
          <Stat
            label="Stock value"
            value={money(stockValue, cur)}
            accent={COLORS.sky}
            icon="coins"
            delay={180}
          />
        </div>
      </div>

      <div className="row g-4 align-items-start">
        <div className="col-12 col-xl-4">
          <Card
            title={editId ? "Edit item" : "New item"}
            subtitle={
              editId
                ? "Changing an item does not change its stock."
                : "Add a product to your catalogue."
            }
            delay={120}
          >
            <Notice msg={msg} />
            <form onSubmit={save} className="row g-3">
              <div className="col-6">
                <Field id="sku" label="SKU">
                  <input
                    id="sku"
                    className="form-control"
                    required
                    value={draft.sku}
                    onChange={set("sku")}
                  />
                </Field>
              </div>
              <div className="col-6">
                <Field id="unit" label="Unit">
                  <input
                    id="unit"
                    className="form-control"
                    value={draft.unit}
                    onChange={set("unit")}
                  />
                </Field>
              </div>
              <div className="col-12">
                <Field id="name" label="Name">
                  <input
                    id="name"
                    className="form-control"
                    required
                    value={draft.name}
                    onChange={set("name")}
                  />
                </Field>
              </div>
              <div className="col-12">
                <Field id="cat" label="Category">
                  <select
                    id="cat"
                    className="form-select"
                    value={draft.category_id}
                    onChange={set("category_id")}
                  >
                    <option value="">Uncategorized</option>
                    {cats.data.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="col-6">
                <Field id="qty" label="Opening qty">
                  <input
                    id="qty"
                    type="number"
                    min={0}
                    className="form-control"
                    value={draft.qty}
                    onChange={set("qty")}
                    disabled={!!editId}
                  />
                </Field>
              </div>
              <div className="col-6">
                <Field id="reorder" label="Reorder at">
                  <input
                    id="reorder"
                    type="number"
                    min={0}
                    className="form-control"
                    value={draft.reorder_level}
                    onChange={set("reorder_level")}
                  />
                </Field>
              </div>
              <div className="col-6">
                <Field id="cost" label="Cost price">
                  <input
                    id="cost"
                    type="number"
                    min={0}
                    step="0.01"
                    className="form-control"
                    value={draft.unit_cost}
                    onChange={set("unit_cost")}
                  />
                </Field>
              </div>
              <div className="col-6">
                <Field id="price" label="Selling price">
                  <input
                    id="price"
                    type="number"
                    min={0}
                    step="0.01"
                    className="form-control"
                    value={draft.unit_price}
                    onChange={set("unit_price")}
                  />
                </Field>
              </div>

              {fields.data.map((f) => (
                <div className="col-12" key={f.id}>
                  <Field id={`f-${f.field_key}`} label={f.label}>
                    <input
                      id={`f-${f.field_key}`}
                      type={f.type}
                      className="form-control"
                      value={draft.extra[f.field_key] ?? ""}
                      onChange={(e) => setExtra(f.field_key, e.target.value)}
                    />
                  </Field>
                </div>
              ))}

              <div className="col-12 d-flex flex-wrap gap-2 pt-1">
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={busy}
                >
                  {busy && <MorphLoader />}
                  <Icon name={editId ? "check" : "plus"} size={15} />{" "}
                  {editId ? "Save changes" : "Add item"}
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

          <div className="mt-4">
            <Card
              title="Categories"
              subtitle="Group items so filters and charts stay clear."
              delay={180}
            >
              <form onSubmit={addCategory} className="input-group mb-3">
                <input
                  className="form-control"
                  placeholder="New category name"
                  aria-label="New category"
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                />
                <button
                  className="btn btn-dark"
                  type="submit"
                  disabled={catBusy}
                >
                  {catBusy && <MorphLoader />}
                  <Icon name="plus" size={14} /> Add
                </button>
              </form>
              <div className="d-flex flex-wrap gap-2">
                {cats.data.map((c) => (
                  <span
                    key={c.id}
                    className="chip chip-neutral"
                    style={{ fontSize: ".84rem", padding: ".35rem .8rem" }}
                  >
                    {c.name}
                  </span>
                ))}
                {!cats.data.length && (
                  <span className="text-muted small">No categories yet.</span>
                )}
              </div>
            </Card>
          </div>
        </div>

        <div className="col-12 col-xl-8">
          <Card
            title={`All items (${items.data.length})`}
            subtitle="Edit or remove any item from the table."
            delay={180}
          >
            <DataTable
              rows={items.data}
              columns={columns}
              rowKey={(i) => i.id}
              empty="No items yet. Add your first product on the left."
              emptyIcon="box"
              minWidth={820}
            />
          </Card>

          {valueByCategory.length > 0 && (
            <div className="mt-4">
              <Card
                title="Stock value by category"
                subtitle="Quantity × cost, so you can see where your money is tied up."
                delay={240}
              >
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={valueByCategory}
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
                      tick={AXIS_TICK}
                      axisLine={false}
                      tickLine={false}
                      width={64}
                      tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`}
                    />
                    <Tooltip
                      contentStyle={TOOLTIP_STYLE}
                      formatter={(v) => money(Number(v), cur)}
                      cursor={{ fill: "rgba(15, 23, 42,.04)" }}
                    />
                    <Bar
                      isAnimationActive={false}
                      dataKey="value"
                      radius={[8, 8, 0, 0]}
                      animationDuration={800}
                    >
                      {valueByCategory.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
