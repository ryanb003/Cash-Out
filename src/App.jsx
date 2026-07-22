import React, { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

// --- Helper Functions ---
const calcPMT = (rate: number, years: number, amount: number) => {
  if (!amount || !years) return 0;
  const r = rate / 100 / 12;
  const n = years * 12;
  if (r === 0) return amount / n;
  return (amount * r) / (1 - Math.pow(1 + r, -n));
};

const formatCurrency = (val: number) => {
  if (isNaN(val) || val === null || val === undefined) return "$0";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(val);
};

const formatMonthsToYears = (totalMonths: number) => {
  if (isNaN(totalMonths) || !totalMonths) return "0 Mos";
  const y = Math.floor(totalMonths / 12);
  const m = totalMonths % 12;
  if (y === 0) return `${m} Mos`;
  if (m === 0) return `${y} Yrs`;
  return `${y} Yrs, ${m} Mos`;
};

export default function App() {
  // --- Current Mortgage State ---
const [oldBalance, setOldBalance] = useState("");
const [oldRate, setOldRate] = useState("");
const [oldPmt, setOldPmt] = useState("");

  // --- Debts State ---
  const [debts, setDebts] = useState([
    {
      id: 1,
      name: "Credit Card 1",
      balance: "",
      rate: "",
      minPmt: "",
      actualPmt: "",
    },
  ]);

  // --- New Cash-Out Loan State ---
  const [newLoanAmount, setNewLoanAmount] = useState("");
  const [newRate, setNewRate] = useState("");
  const [newTerm, setNewTerm] = useState(30);
  const [reinvestSavings, setReinvestSavings] = useState(false);
  const [extraNewPrincipal, setExtraNewPrincipal] = useState("");

  // --- Debt Handlers ---
  const addDebt = () => {
    setDebts([
      ...debts,
      {
        id: Date.now(),
        name: `Debt ${debts.length + 1}`,
        balance: "",
        rate: "",
        minPmt: "",
        actualPmt: "",
      },
    ]);
  };

  const updateDebt = (id: number, field: string, value: string) => {
    setDebts(debts.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  };

  const removeDebt = (id: number) => {
    setDebts(debts.filter((d) => d.id !== id));
  };

  // --- Core Engine ---
  const data = useMemo(() => {
    const mortBal = Number(oldBalance) || 0;
    const mortRate = Number(oldRate) || 0;
    const mortPmt = Number(oldPmt) || 0;

    let totalDebtBalance = 0;
    let totalDebtMonthlyPmt = 0;
    let totalDebtAnnualInt = 0;

    const activeDebts = debts.map((d) => {
      const bal = Number(d.balance) || 0;
      const rate = Number(d.rate) || 0;
      const minPmt = Number(d.minPmt) || 0;
      const actualPmt = Number(d.actualPmt) || 0;
      const activePayment = actualPmt > 0 ? actualPmt : minPmt;
      const monthlyRate = rate / 100 / 12;

      let monthsToPayoff = 0;
      let tempBal = bal;
      if (bal > 0 && activePayment > 0) {
        while (tempBal > 0 && monthsToPayoff < 1200) {
          const int = tempBal * monthlyRate;
          const prin = activePayment - int;
          if (prin <= 0) {
            monthsToPayoff = Infinity;
            break;
          }
          tempBal -= prin;
          monthsToPayoff++;
        }
      }
      totalDebtBalance += bal;
      totalDebtMonthlyPmt += activePayment;
      totalDebtAnnualInt += bal * (rate / 100);
      return { ...d, bal, rate: monthlyRate, activePayment, monthsToPayoff };
    });

    const totalStartingBalance = mortBal + totalDebtBalance;
    const mortAnnualInt = mortBal * (mortRate / 100);
    const blendedRate =
      totalStartingBalance > 0
        ? ((mortAnnualInt + totalDebtAnnualInt) / totalStartingBalance) * 100
        : 0;

    const totalOldMonthlyOutflow = mortPmt + totalDebtMonthlyPmt;
    const newBal = Number(newLoanAmount) || 0;
    const rateNew = Number(newRate) || 0;
    const termNew = Number(newTerm) || 0;
    const baseNewPmt = calcPMT(rateNew, termNew, newBal);

    const savings = totalOldMonthlyOutflow - baseNewPmt;
    const extraFromSavings = reinvestSavings ? Math.max(0, savings) : 0;
    const manualExtra = Number(extraNewPrincipal) || 0;
    const totalExtraMonthly = extraFromSavings + manualExtra;

    let currentOldMortBal = mortBal;
    let currentDebtsBal = activeDebts.map((d) => ({ ...d }));
    let currentNewBal = newBal;
    const newR = rateNew / 100 / 12;
    const oldR = mortRate / 100 / 12;

    let oldTotalInterest = 0;
    let newTotalInterest = 0;
    let newPayoffMonth = 0;
    const chartData = [];

    const MAX_MONTHS = 480;

    for (let month = 1; month <= MAX_MONTHS; month++) {
      let oldMortInt = 0;
      if (currentOldMortBal > 0) {
        oldMortInt = currentOldMortBal * oldR;
        oldTotalInterest += oldMortInt;
        currentOldMortBal -= mortPmt - oldMortInt;
        if (currentOldMortBal < 0) currentOldMortBal = 0;
      }

      let debtsBalThisMonth = 0;
      for (let i = 0; i < currentDebtsBal.length; i++) {
        let d = currentDebtsBal[i];
        if (d.bal > 0) {
          const int = d.bal * d.rate;
          oldTotalInterest += int;
          let prin = d.activePayment - int;
          if (prin < 0) prin = 0;
          if (d.bal - prin < 0) {
            d.bal = 0;
          } else {
            d.bal -= prin;
          }
        }
        debtsBalThisMonth += d.bal;
      }

      if (currentNewBal > 0) {
        const int = currentNewBal * newR;
        newTotalInterest += int;
        const prin = baseNewPmt - int + totalExtraMonthly;
        currentNewBal -= prin;
        if (currentNewBal <= 0) {
          currentNewBal = 0;
          if (newPayoffMonth === 0) newPayoffMonth = month;
        }
      }

      chartData.push({
        month,
        oldBalance: Math.round(currentOldMortBal + debtsBalThisMonth),
        newBalance: Math.round(currentNewBal),
      });

      if (
        month >= 12 &&
        currentOldMortBal + debtsBalThisMonth <= 0 &&
        currentNewBal <= 0
      ) {
        break;
      }
    }

    return {
      totalStartingBalance,
      totalDebtBalance,
      totalOldMonthlyOutflow,
      blendedRate,
      newBal,
      baseNewPmt,
      savings,
      totalInterestSaved: oldTotalInterest - newTotalInterest,
      activeDebts,
      chartData,
      newPayoffMonth,
    };
  }, [
    oldBalance,
    oldRate,
    oldPmt,
    debts,
    newLoanAmount,
    newRate,
    newTerm,
    reinvestSavings,
    extraNewPrincipal,
  ]);

  const inputStyle = {
    width: "100%",
    padding: "8px",
    marginTop: "4px",
    borderRadius: "4px",
    border: "1px solid #d1d5db",
  };
  const cardStyle = {
    background: "#fff",
    padding: "20px",
    border: "1px solid #e5e7eb",
    borderRadius: "12px",
    boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
  };
  const cardLabelStyle = {
    fontSize: "13px",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: "bold",
  };
  const headerLabelStyle = {
    fontSize: "11px",
    fontWeight: "bold",
    color: "#6b7280",
    textTransform: "uppercase",
  };

  return (
    <div
      style={{
        fontFamily: "system-ui, sans-serif",
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "20px",
        backgroundColor: "#f9fafb",
        minHeight: "100vh",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `@media print { .no-print { display: none !important; } body { background-color: white !important; } .print-break { page-break-inside: avoid; margin-bottom: 20px; } }`,
        }}
      />

      <div
        className="no-print"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h1 style={{ color: "#1f2937", margin: 0 }}>
          Debt Consolidation Strategy
        </h1>
        <button
          onClick={() => window.print()}
          style={{
            padding: "10px 20px",
            backgroundColor: "#10b981",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          🖨️ Export to PDF
        </button>
      </div>

      <div
        className="print-break"
        style={{
          background: "#ffffff",
          padding: "25px",
          borderRadius: "12px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
          marginBottom: "25px",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "25px" }}>
          <div style={{ flex: "1 1 450px" }}>
            <h3
              style={{
                color: "#374151",
                borderBottom: "2px solid #e5e7eb",
                paddingBottom: "10px",
                marginTop: 0,
              }}
            >
              1. Current Mortgage
            </h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "10px",
                marginBottom: "20px",
              }}
            >
              <label style={{ fontSize: "14px" }}>
                Balance ($):
                <input
                  type="number"
                  value={oldBalance}
                  onChange={(e) => setOldBalance(e.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={{ fontSize: "14px" }}>
                Rate (%):
                <input
                  type="number"
                  step="0.125"
                  value={oldRate}
                  onChange={(e) => setOldRate(e.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={{ fontSize: "14px" }}>
                P&I Pmt ($):
                <input
                  type="number"
                  value={oldPmt}
                  onChange={(e) => setOldPmt(e.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "15px",
              }}
            >
              <h3 style={{ color: "#374151", margin: 0 }}>
                2. Debts to Consolidate
              </h3>
              <button
                onClick={addDebt}
                className="no-print"
                style={{
                  background: "#10b981",
                  color: "white",
                  border: "none",
                  padding: "5px 10px",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontSize: "12px",
                }}
              >
                + Add Debt
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1.2fr auto",
                gap: "8px",
                padding: "0 12px 5px 12px",
              }}
            >
              <div style={headerLabelStyle}>Name</div>
              <div style={headerLabelStyle}>Balance</div>
              <div style={headerLabelStyle}>Rate %</div>
              <div style={headerLabelStyle}>Min Pmt</div>
              <div style={headerLabelStyle}>Actual Pmt</div>
              <div style={{ width: "20px" }}></div>
            </div>

            {data.activeDebts.map((debt, index) => (
              <div
                key={debt.id}
                style={{
                  marginBottom: "12px",
                  background: "#f9fafb",
                  padding: "12px",
                  borderRadius: "6px",
                  border: "1px solid #e5e7eb",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1.2fr auto",
                    gap: "8px",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    value={debt.name}
                    onChange={(e) =>
                      updateDebt(debt.id, "name", e.target.value)
                    }
                    style={inputStyle}
                    placeholder="Name"
                  />
                  <input
                    type="number"
                    value={debts[index].balance}
                    onChange={(e) =>
                      updateDebt(debt.id, "balance", e.target.value)
                    }
                    style={inputStyle}
                    placeholder="Balance"
                  />
                  <input
                    type="number"
                    value={debts[index].rate}
                    onChange={(e) =>
                      updateDebt(debt.id, "rate", e.target.value)
                    }
                    style={{ ...inputStyle, background: "#fef2f2" }}
                    placeholder="Rate %"
                  />
                  <input
                    type="number"
                    value={debts[index].minPmt}
                    onChange={(e) =>
                      updateDebt(debt.id, "minPmt", e.target.value)
                    }
                    style={inputStyle}
                    placeholder="Min Pmt"
                  />
                  <input
                    type="number"
                    value={debts[index].actualPmt}
                    onChange={(e) =>
                      updateDebt(debt.id, "actualPmt", e.target.value)
                    }
                    style={{ ...inputStyle, background: "#f0fdf4" }}
                    placeholder="Actual"
                  />
                  {debts.length > 1 && (
                    <button
                      onClick={() => removeDebt(debt.id)}
                      className="no-print"
                      style={{
                        background: "transparent",
                        color: "#ef4444",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "18px",
                        padding: "0 5px",
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "12px",
                    fontWeight: "bold",
                    color:
                      debt.monthsToPayoff === Infinity ? "#b91c1c" : "#b45309",
                  }}
                >
                  {debt.monthsToPayoff === Infinity
                    ? "⚠️ Payment doesn't cover interest"
                    : `⏳ Payoff Time: ${formatMonthsToYears(
                        debt.monthsToPayoff
                      )}`}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              flex: "1 1 300px",
              paddingLeft: "20px",
              borderLeft: "2px dashed #d1d5db",
            }}
          >
            <h3
              style={{
                color: "#1d4ed8",
                borderBottom: "2px solid #bfdbfe",
                paddingBottom: "10px",
                marginTop: 0,
              }}
            >
              3. New Cash-Out Refinance
            </h3>
            <label
              style={{ fontSize: "14px", fontWeight: "bold", color: "#1e40af" }}
            >
              New Loan Amount ($):
              <input
                type="number"
                value={newLoanAmount}
                onChange={(e) => setNewLoanAmount(e.target.value)}
                style={{ ...inputStyle, border: "2px solid #93c5fd" }}
              />
            </label>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "10px",
                marginTop: "10px",
              }}
            >
              <label style={{ fontSize: "14px" }}>
                Rate (%):
                <input
                  type="number"
                  step="0.125"
                  value={newRate}
                  onChange={(e) => setNewRate(e.target.value)}
                  style={inputStyle}
                />
              </label>
              <label style={{ fontSize: "14px" }}>
                Term (Yrs):
                <input
                  type="number"
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  style={inputStyle}
                />
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "10px",
                marginTop: "20px",
              }}
            >
              <div
                style={{
                  padding: "12px",
                  background: "#f8fafc",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    color: "#64748b",
                    fontWeight: "bold",
                  }}
                >
                  TOTAL DEBTS
                </div>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: "900",
                    color: "#475569",
                  }}
                >
                  {formatCurrency(data.totalStartingBalance)}
                </div>
              </div>
              <div
                style={{
                  padding: "12px",
                  background: "#eff6ff",
                  borderRadius: "8px",
                  border: "1px solid #bfdbfe",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    color: "#1e40af",
                    fontWeight: "bold",
                  }}
                >
                  NEW P&I
                </div>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: "900",
                    color: "#1d4ed8",
                  }}
                >
                  {formatCurrency(data.baseNewPmt)}
                </div>
              </div>
              <div
                style={{
                  padding: "12px",
                  background: "#f0fdf4",
                  borderRadius: "8px",
                  border: "1px solid #bbf7d0",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    color: "#166534",
                    fontWeight: "bold",
                  }}
                >
                  PAYOFF IN
                </div>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: "900",
                    color: "#15803d",
                  }}
                >
                  {formatMonthsToYears(data.newPayoffMonth)}
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: "20px",
                padding: "15px",
                background: "#f0fdf4",
                borderRadius: "8px",
                border: "1px solid #86efac",
              }}
            >
              <h4 style={{ color: "#166534", margin: "0 0 10px 0" }}>
                Wealth Accelerator
              </h4>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  fontSize: "13px",
                  fontWeight: "bold",
                  cursor: "pointer",
                  color: "#15803d",
                  marginBottom: "10px",
                }}
              >
                <input
                  type="checkbox"
                  checked={reinvestSavings}
                  onChange={(e) => setReinvestSavings(e.target.checked)}
                />
                Add {formatCurrency(Math.max(0, data.savings))} Savings to
                Principal
              </label>
              <label
                style={{
                  fontSize: "13px",
                  fontWeight: "bold",
                  color: "#15803d",
                }}
              >
                Other Extra Principal ($):
                <input
                  type="number"
                  value={extraNewPrincipal}
                  onChange={(e) => setExtraNewPrincipal(e.target.value)}
                  style={{ ...inputStyle, border: "1px solid #86efac" }}
                  placeholder="e.g. 100"
                />
              </label>
            </div>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "15px",
          marginBottom: "25px",
        }}
      >
        <div style={{ ...cardStyle, borderTop: "4px solid #ef4444" }}>
          <div style={cardLabelStyle}>Blended Rate (Old)</div>
          <div
            style={{ fontSize: "28px", fontWeight: "900", color: "#b91c1c" }}
          >
            {data.blendedRate.toFixed(3)}%
          </div>
        </div>
        <div style={{ ...cardStyle, borderTop: "4px solid #3b82f6" }}>
          <div style={cardLabelStyle}>New Fixed Rate</div>
          <div
            style={{ fontSize: "28px", fontWeight: "900", color: "#1d4ed8" }}
          >
            {Number(newRate || 0).toFixed(3)}%
          </div>
        </div>
        <div style={{ ...cardStyle, borderTop: "4px solid #10b981" }}>
          <div style={cardLabelStyle}>Monthly Savings</div>
          <div
            style={{ fontSize: "28px", fontWeight: "900", color: "#065f46" }}
          >
            {formatCurrency(Math.max(0, data.savings))}
          </div>
        </div>
        {data.totalInterestSaved > 0 && (
          <div style={{ ...cardStyle, borderTop: "4px solid #f59e0b" }}>
            <div style={cardLabelStyle}>Total Interest Saved</div>
            <div
              style={{ fontSize: "28px", fontWeight: "900", color: "#b45309" }}
            >
              {formatCurrency(data.totalInterestSaved)}
            </div>
          </div>
        )}
      </div>

      <div
        className="print-break"
        style={{
          background: data.savings > 0 ? "#f0fdf4" : "#fef2f2",
          border: `2px solid ${data.savings > 0 ? "#22c55e" : "#ef4444"}`,
          borderRadius: "12px",
          padding: "30px",
          textAlign: "center",
          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)",
          marginBottom: "30px",
        }}
      >
        <h2
          style={{
            color: data.savings > 0 ? "#166534" : "#991b1b",
            margin: "0 0 10px 0",
          }}
        >
          Monthly Cash Flow Impact
        </h2>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "30px",
            marginBottom: "15px",
            color: "#4b5563",
            fontSize: "15px",
          }}
        >
          <div>
            Current Total:{" "}
            <strong>{formatCurrency(data.totalOldMonthlyOutflow)}</strong>
          </div>
          <div>
            New Single Payment:{" "}
            <strong>{formatCurrency(data.baseNewPmt)}</strong>
          </div>
        </div>
        <div
          style={{
            fontSize: "48px",
            fontWeight: "900",
            color: data.savings > 0 ? "#14532d" : "#7f1d1d",
          }}
        >
          {data.savings > 0
            ? `Immediate Savings of ${formatCurrency(data.savings)} / mo`
            : `Increase of ${formatCurrency(Math.abs(data.savings))} / mo`}
        </div>
      </div>

      <div
        style={{
          background: "#fff",
          padding: "20px",
          borderRadius: "12px",
          border: "1px solid #e5e7eb",
          overflowX: "auto", 
        }}
      >
        <div style={{ minWidth: "800px" }}>
          {data.chartData.length > 0 ? (
            <LineChart
              width={850}
              height={400}
              data={data.chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="month"
                label={{
                  value: "Months",
                  position: "insideBottomRight",
                  offset: -5,
                }}
              />
              <YAxis tickFormatter={(val) => "$" + val / 1000 + "k"} />
              <Tooltip formatter={(value: any) => formatCurrency(value)} />
              <Legend verticalAlign="top" />
              <Line
                type="monotone"
                dataKey="oldBalance"
                name="Current Situation"
                stroke="#ef4444"
                strokeWidth={3}
                dot={false}
              />
              <Line
                type="monotone"
                dataKey="newBalance"
                name="Accelerated Refi"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          ) : (
            <div style={{ height: "400px", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af" }}>
               Enter values to generate projection chart
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
