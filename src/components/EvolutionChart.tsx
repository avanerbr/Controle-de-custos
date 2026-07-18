"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatBRL } from "@/lib/utils";

export interface EvolutionPoint {
  label: string;
  casa: number;
  empresa: number;
  total: number;
}

export default function EvolutionChart({ data }: { data: EvolutionPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
        <YAxis
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => v.toLocaleString("pt-BR", { notation: "compact" })}
        />
        <Tooltip formatter={(value: number) => formatBRL(value)} />
        <Legend />
        <Line type="monotone" dataKey="casa" name="Casa" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
        <Line
          type="monotone"
          dataKey="empresa"
          name="Empresa"
          stroke="#16a34a"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="total"
          name="Total"
          stroke="#0f172a"
          strokeWidth={2}
          strokeDasharray="4 4"
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
