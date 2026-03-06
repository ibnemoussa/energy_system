import React, { useState, useMemo } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/forecast/run/";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import { Zap, Download, ChevronLeft, ChevronRight } from "lucide-react";

/* ---------------- TRANSLATIONS ---------------- */

const TRANSLATIONS = {
  en: {
    title: "AI Energy Forecasting System",
    singleDay: "Single Day",
    dateRange: "Date Range",
    today: "Today",
    tomorrow: "Tomorrow",
    dayAfter: "Day After",
    generateForecast: "Generate Forecast",
    rangeInfo: "Maximum range: 7 days (forecast limit).",
    runningModel: "Running model...",
    runningModelSub: "This may take a few seconds",
    totalEnergy: "Total Energy",
    peakPower: "Peak Power",
    hourlyBreakdown: "Hourly Forecast Breakdown",
    dailyBreakdown: "Daily Forecast Breakdown",
    hourlyTitle: (date) => `Hourly Energy Forecast (${date || "Select Date"})`,
    dailyTitle: (s, e) => `Daily Energy Forecast (${s || "Start"} to ${e || "End"})`,
    colHour: "Hour",
    colDate: "Date",
    colTemp: "Temp (°C)",
    colHumidity: "Humidity (%)",
    colIrradiance: "Irradiance (W/m²)",
    colWind: "Wind (km/h)",
    colEnergy: "Energy (kWh)",
    xAxisHourly: "Time (Hours)",
    xAxisDaily: "Date",
    yAxis: "Power (kW)",
    exportCsv: "Export CSV",
    page: (cur, total) => `Page ${cur} of ${total}`,
    entries: (n) => `${n} entries`,
    errSelectDate: "Please select a date.",
    errSelectDates: "Please select start and end dates.",
    errEndBeforeStart: "End date cannot be earlier than start date.",
    errRangeExceeds: "Date range cannot exceed 7 days (Open-Meteo forecast limit).",
    errNoServer: "Could not reach the forecast server. Make sure the backend is running.",
    csvPeriodHour: "Hour",
    csvPeriodDate: "Date",
    csvTemp: "Temperature(C)",
    csvHumidity: "Humidity(%)",
    csvIrradiance: "Irradiance(W/m2)",
    csvWind: "Wind(km/h)",
    csvEnergy: "Energy(kWh)",
  },
  fr: {
    title: "Système de Prévision Énergétique IA",
    singleDay: "Jour Unique",
    dateRange: "Plage de Dates",
    today: "Aujourd'hui",
    tomorrow: "Demain",
    dayAfter: "Après-demain",
    generateForecast: "Générer la Prévision",
    rangeInfo: "Plage maximale : 7 jours (limite de prévision).",
    runningModel: "Exécution du modèle...",
    runningModelSub: "Cela peut prendre quelques secondes",
    totalEnergy: "Énergie Totale",
    peakPower: "Puissance de Pointe",
    hourlyBreakdown: "Détail Horaire de la Prévision",
    dailyBreakdown: "Détail Journalier de la Prévision",
    hourlyTitle: (date) => `Prévision Énergétique Horaire (${date || "Sélectionner une date"})`,
    dailyTitle: (s, e) => `Prévision Énergétique Journalière (${s || "Début"} à ${e || "Fin"})`,
    colHour: "Heure",
    colDate: "Date",
    colTemp: "Temp (°C)",
    colHumidity: "Humidité (%)",
    colIrradiance: "Irradiance (W/m²)",
    colWind: "Vent (km/h)",
    colEnergy: "Énergie (kWh)",
    xAxisHourly: "Temps (Heures)",
    xAxisDaily: "Date",
    yAxis: "Puissance (kW)",
    exportCsv: "Exporter CSV",
    page: (cur, total) => `Page ${cur} sur ${total}`,
    entries: (n) => `${n} entrées`,
    errSelectDate: "Veuillez sélectionner une date.",
    errSelectDates: "Veuillez sélectionner les dates de début et de fin.",
    errEndBeforeStart: "La date de fin ne peut pas être antérieure à la date de début.",
    errRangeExceeds: "La plage de dates ne peut pas dépasser 7 jours (limite Open-Meteo).",
    errNoServer: "Impossible de contacter le serveur. Assurez-vous que le backend est actif.",
    csvPeriodHour: "Heure",
    csvPeriodDate: "Date",
    csvTemp: "Température(C)",
    csvHumidity: "Humidité(%)",
    csvIrradiance: "Irradiance(W/m2)",
    csvWind: "Vent(km/h)",
    csvEnergy: "Énergie(kWh)",
  },
  ar: {
    title: "نظام التنبؤ بالطاقة بالذكاء الاصطناعي",
    singleDay: "يوم واحد",
    dateRange: "نطاق تاريخي",
    today: "اليوم",
    tomorrow: "غداً",
    dayAfter: "بعد غد",
    generateForecast: "توليد التنبؤ",
    rangeInfo: "الحد الأقصى للنطاق: 7 أيام (حد التنبؤ).",
    runningModel: "جارٍ تشغيل النموذج...",
    runningModelSub: "قد يستغرق ذلك بضع ثوانٍ",
    totalEnergy: "إجمالي الطاقة",
    peakPower: "الطاقة القصوى",
    hourlyBreakdown: "تفصيل التنبؤ الساعي",
    dailyBreakdown: "تفصيل التنبؤ اليومي",
    hourlyTitle: (date) => `التنبؤ الساعي بالطاقة (${date || "اختر تاريخاً"})`,
    dailyTitle: (s, e) => `التنبؤ اليومي بالطاقة (${s || "البداية"} إلى ${e || "النهاية"})`,
    colHour: "الساعة",
    colDate: "التاريخ",
    colTemp: "الحرارة (°م)",
    colHumidity: "الرطوبة (%)",
    colIrradiance: "الإشعاع (W/m²)",
    colWind: "الريح (كم/س)",
    colEnergy: "الطاقة (كيلوواط/س)",
    xAxisHourly: "الوقت (ساعات)",
    xAxisDaily: "التاريخ",
    yAxis: "القدرة (كيلوواط)",
    exportCsv: "تصدير CSV",
    page: (cur, total) => `صفحة ${cur} من ${total}`,
    entries: (n) => `${n} إدخالات`,
    errSelectDate: "يرجى اختيار تاريخ.",
    errSelectDates: "يرجى اختيار تواريخ البداية والنهاية.",
    errEndBeforeStart: "لا يمكن أن يكون تاريخ النهاية قبل تاريخ البداية.",
    errRangeExceeds: "لا يمكن أن يتجاوز النطاق 7 أيام (حد Open-Meteo).",
    errNoServer: "تعذّر الوصول إلى الخادم. تأكد من تشغيل الواجهة الخلفية.",
    csvPeriodHour: "الساعة",
    csvPeriodDate: "التاريخ",
    csvTemp: "الحرارة(م)",
    csvHumidity: "الرطوبة(%)",
    csvIrradiance: "الإشعاع(W/m2)",
    csvWind: "الريح(كم/س)",
    csvEnergy: "الطاقة(كيلوواط/س)",
  },
};

/* ---------------- DATE HELPERS ---------------- */

const formatDate = (date) => date.toLocaleDateString("en-CA");
const todayString = formatDate(new Date());
const offsetDate = (days) =>
  formatDate(new Date(Date.now() + days * 24 * 60 * 60 * 1000));

const ROWS_PER_PAGE = 10;

export default function EnergyForecastDashboard() {
  const [lang, setLang] = useState("en");
  const [forecastType, setForecastType] = useState("single");
  const [singleDate, setSingleDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [energyData, setEnergyData] = useState([]);
  const [weatherSummary, setWeatherSummary] = useState([]);
  const [page, setPage] = useState(0);

  const t = TRANSLATIONS[lang];
  const isRtl = lang === "ar";

  const QUICK_DATES = [
    { label: t.today,    days: 0 },
    { label: t.tomorrow, days: 1 },
    { label: t.dayAfter, days: 2 },
  ];

  /* ---------------- AXIS LABELS ---------------- */

  const xAxisLabel = forecastType === "single" ? t.xAxisHourly : t.xAxisDaily;
  const yAxisLabel = t.yAxis;

  /* ---------------- VALIDATION ---------------- */

  const validateInputs = () => {
    if (forecastType === "single" && !singleDate) {
      setError(t.errSelectDate);
      return false;
    }
    if (forecastType === "range") {
      if (!startDate || !endDate) {
        setError(t.errSelectDates);
        return false;
      }
      if (new Date(endDate) < new Date(startDate)) {
        setError(t.errEndBeforeStart);
        return false;
      }
      const diffDays =
        (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
      if (diffDays > 6) {
        setError(t.errRangeExceeds);
        return false;
      }
    }
    setError("");
    return true;
  };

  /* ---------------- API CALL ---------------- */

  const handleForecast = async () => {
    if (!validateInputs()) return;
    setLoading(true);
    setError("");

    const payload = { mode: forecastType };
    if (forecastType === "single") {
      payload.single_date = singleDate;
    } else {
      payload.start_date = startDate;
      payload.end_date = endDate;
    }

    try {
      const { data } = await axios.post(API_URL, payload);
      setEnergyData(data.energy_data);
      setWeatherSummary(data.weather_summary);
      setPage(0);
    } catch (err) {
      setError(
        err.response?.data?.error || t.errNoServer
      );
    } finally {
      setLoading(false);
    }
  };

  /* ---------------- KPIs ---------------- */

  const totalEnergy = useMemo(
    () => energyData.reduce((sum, d) => sum + d.energy, 0),
    [energyData]
  );

  const peakEnergy = useMemo(
    () => (energyData.length ? Math.max(...energyData.map((d) => d.energy)) : 0),
    [energyData]
  );

  /* ---------------- TABLE + PAGINATION ---------------- */

  const tableRows = weatherSummary;
  const totalPages = Math.ceil(tableRows.length / ROWS_PER_PAGE);
  const pagedRows = tableRows.slice(
    page * ROWS_PER_PAGE,
    (page + 1) * ROWS_PER_PAGE
  );

  /* ---------------- EXPORT ---------------- */

  const exportCSV = () => {
    if (!tableRows.length) return;
    const periodLabel = forecastType === "single" ? t.csvPeriodHour : t.csvPeriodDate;
    const header =
      `${periodLabel},${t.csvTemp},${t.csvHumidity},${t.csvIrradiance},${t.csvWind},${t.csvEnergy}\n`;
    const rows = tableRows
      .map(
        (d) =>
          `${d.label},${d.temperature.toFixed(2)},${d.humidity.toFixed(2)},` +
          `${d.irradiance.toFixed(2)},${d.wind.toFixed(2)},${d.energy.toFixed(4)}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `forecast_${Date.now()}.csv`;
    link.click();
  };

  const chartTitle =
    forecastType === "single"
      ? t.hourlyTitle(singleDate)
      : t.dailyTitle(startDate, endDate);

  /* ---------------- UI ---------------- */

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen bg-gradient-to-br from-slate-200 via-emerald-100 to-slate-300 text-slate-900 p-8"
    >

      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-10"
      >
        {/* LANGUAGE SWITCHER */}
        <div className="flex justify-end mb-4">
          <select
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            className="text-sm rounded-xl border border-gray-300 bg-white text-slate-700 px-3 py-1.5 focus:outline-none focus:border-emerald-400 cursor-pointer"
          >
            <option value="en">🌐 English</option>
            <option value="fr">🌐 Français</option>
            <option value="ar">🌐 العربية</option>
          </select>
        </div>

        <h1 className="text-4xl font-bold flex items-center justify-center gap-3">
          <Zap className="text-yellow-500" />
          {t.title}
        </h1>
      </motion.div>

      <div className="grid md:grid-cols-3 gap-6">

        {/* CONFIG CARD */}
        <Card className="bg-white shadow-xl border border-gray-200 rounded-3xl">
          <CardContent className="p-6 space-y-4">

            <div className="flex gap-3">
              <Button
                onClick={() => setForecastType("single")}
                className="w-full rounded-2xl"
              >
                {t.singleDay}
              </Button>
              <Button
                onClick={() => setForecastType("range")}
                className="w-full rounded-2xl"
              >
                {t.dateRange}
              </Button>
            </div>

            {forecastType === "single" && (
              <>
                <div className="flex gap-2">
                  {QUICK_DATES.map(({ label, days }) => {
                    const val = offsetDate(days);
                    return (
                      <button
                        key={label}
                        onClick={() => setSingleDate(val)}
                        className={
                          "flex-1 text-xs py-1.5 rounded-xl border transition-colors " +
                          (singleDate === val
                            ? "bg-emerald-500 text-white border-emerald-500"
                            : "bg-white text-slate-600 border-gray-300 hover:border-emerald-400")
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <Input
                  type="date"
                  value={singleDate}
                  min={todayString}
                  onChange={(e) => setSingleDate(e.target.value)}
                />
              </>
            )}

            {forecastType === "range" && (
              <>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <div className="text-xs text-blue-500 bg-blue-50 rounded-xl px-3 py-2">
                  {t.rangeInfo}
                </div>
              </>
            )}

            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}

            <Button
              onClick={handleForecast}
              disabled={loading}
              className="w-full rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {t.generateForecast}
            </Button>

          </CardContent>
        </Card>

        {/* RESULTS CARD */}
        <Card className="md:col-span-2 bg-white shadow-xl border border-gray-200 rounded-3xl relative">

          {/* LOADING OVERLAY */}
          {loading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/85 rounded-3xl">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 rounded-full border-4 border-emerald-100 border-t-emerald-500"
              />
              <p className="mt-5 text-emerald-600 font-semibold tracking-wide">
                {t.runningModel}
              </p>
              <p className="text-xs text-gray-400 mt-1">{t.runningModelSub}</p>
            </div>
          )}

          <CardContent className="p-6">

            <h2 className="text-xl font-semibold text-center mb-4">
              {chartTitle}
            </h2>

            {/* CHART */}
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={energyData}
                  margin={{ top: 20, right: 30, left: 40, bottom: 40 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="label"
                    stroke="#64748b"
                    label={{
                      value: xAxisLabel,
                      position: "insideBottom",
                      offset: -10,
                      style: { fill: "#475569", fontSize: 14 },
                    }}
                  />
                  <YAxis
                    stroke="#64748b"
                    label={{
                      value: yAxisLabel,
                      angle: -90,
                      position: "insideLeft",
                      style: { fill: "#475569", fontSize: 14 },
                    }}
                  />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="energy"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* KPIs */}
            <div className="grid md:grid-cols-2 gap-4 mt-6">
              <div className="bg-emerald-50 p-4 rounded-2xl">
                <p className="text-sm text-gray-500">{t.totalEnergy}</p>
                <p className="text-2xl font-bold text-emerald-600">
                  {totalEnergy.toFixed(2)} kWh
                </p>
              </div>
              <div className="bg-yellow-50 p-4 rounded-2xl">
                <p className="text-sm text-gray-500">{t.peakPower}</p>
                <p className="text-2xl font-bold text-yellow-600">
                  {peakEnergy.toFixed(2)} kW
                </p>
              </div>
            </div>

            {/* RESULTS TABLE */}
            {tableRows.length > 0 && (
              <div className="mt-8">
                <h3 className="text-lg font-semibold mb-3">
                  {forecastType === "single" ? t.hourlyBreakdown : t.dailyBreakdown}
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-gray-600 border-b border-gray-200">
                      <tr>
                        <th className="py-2 pr-4">
                          {forecastType === "single" ? t.colHour : t.colDate}
                        </th>
                        <th className="pr-4">{t.colTemp}</th>
                        <th className="pr-4">{t.colHumidity}</th>
                        <th className="pr-4">{t.colIrradiance}</th>
                        <th className="pr-4">{t.colWind}</th>
                        <th>{t.colEnergy}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((row, index) => (
                        <tr
                          key={index}
                          className="border-b border-gray-100 hover:bg-gray-50"
                        >
                          <td className="py-2 pr-4">{row.label}</td>
                          <td className="pr-4">{row.temperature.toFixed(2)}</td>
                          <td className="pr-4">{row.humidity.toFixed(2)}</td>
                          <td className="pr-4">{row.irradiance.toFixed(2)}</td>
                          <td className="pr-4">{row.wind.toFixed(2)}</td>
                          <td className="font-medium text-emerald-600">
                            {row.energy.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* PAGINATION */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-gray-400">
                      {t.page(page + 1, totalPages)} &middot; {t.entries(tableRows.length)}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                        disabled={page === 0}
                        className="p-1.5 rounded-xl border border-gray-200 disabled:opacity-30 hover:border-emerald-400 transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                      <button
                        onClick={() =>
                          setPage((p) => Math.min(totalPages - 1, p + 1))
                        }
                        disabled={page === totalPages - 1}
                        className="p-1.5 rounded-xl border border-gray-200 disabled:opacity-30 hover:border-emerald-400 transition-colors"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex justify-end mt-4">
                  <Button
                    onClick={exportCSV}
                    variant="outline"
                    className="rounded-2xl flex items-center gap-2"
                  >
                    <Download size={16} /> {t.exportCsv}
                  </Button>
                </div>
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
