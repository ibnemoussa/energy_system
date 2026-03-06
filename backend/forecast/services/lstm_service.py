import os
import requests
import pandas as pd
import numpy as np
import joblib
from tensorflow.keras.models import load_model
from django.conf import settings

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
MODEL_DIR = os.path.join(BASE_DIR, "models")
STATE_DIR = os.path.join(BASE_DIR, "system_state")

LAT       = -2.0261
LON       = 30.3772
TIME_STEPS = 36
DELTA_T   = 10 / 60  # 10-minute intervals → hours

os.makedirs(STATE_DIR, exist_ok=True)

# Load model & scaler once at startup
lstm_model = load_model(os.path.join(MODEL_DIR, "lstm_model_best.keras"))
scaler     = joblib.load(os.path.join(MODEL_DIR, "scaler.pkl"))


# ==========================================================
# SYSTEM STATE
# ==========================================================

def _load_system_state():
    """Return (lstm_sequence, prev_power).

    Priority:
    1. Persisted state from a previous run.
    2. Bootstrap from historical CSV (HISTORICAL_DATA_PATH in settings).
    3. Zero-initialization (first run, no data available).
    """
    window_path = os.path.join(STATE_DIR, "last_lstm_window.pkl")
    power_path  = os.path.join(STATE_DIR, "last_power.pkl")

    if os.path.exists(window_path) and os.path.exists(power_path):
        return joblib.load(window_path), float(joblib.load(power_path))

    hist_path = getattr(settings, "HISTORICAL_DATA_PATH", "")
    if hist_path and os.path.exists(hist_path):
        hist_df = pd.read_csv(hist_path)
        hist_df["Timestamp"] = pd.to_datetime(hist_df["Timestamp"])
        hist_df = hist_df.sort_values("Timestamp")

        prev_power  = float(hist_df["Total_Power_kW"].iloc[-1])
        last_window = hist_df.iloc[-(TIME_STEPS + 1):].copy()
        last_window["Lag1_Power"] = last_window["Total_Power_kW"].shift(1)
        last_window = last_window.iloc[1:]

        lstm_sequence = last_window[
            ["Irradiation_Avg",
             "Environment_Temperature_Avg",
             "WindSpeed_mps",
             "Humidity_%",
             "Lag1_Power"]
        ].values

        return lstm_sequence, prev_power

    return np.zeros((TIME_STEPS, 5)), 0.0


def _save_system_state(lstm_sequence, prev_power):
    joblib.dump(lstm_sequence, os.path.join(STATE_DIR, "last_lstm_window.pkl"))
    joblib.dump(prev_power,    os.path.join(STATE_DIR, "last_power.pkl"))


# ==========================================================
# WEATHER (Open-Meteo, 7-day hourly → 10-min interpolated)
# ==========================================================

def fetch_weather():
    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={LAT}&longitude={LON}"
        f"&hourly=shortwave_radiation,temperature_2m,"
        f"relative_humidity_2m,windspeed_10m"
        f"&forecast_days=7"
        f"&timezone=Africa/Kigali"
    )

    data = requests.get(url, timeout=15).json()

    df = pd.DataFrame({
        "Time":                        data["hourly"]["time"],
        "Irradiation_Avg":             data["hourly"]["shortwave_radiation"],
        "Environment_Temperature_Avg": data["hourly"]["temperature_2m"],
        "Humidity_%":                  data["hourly"]["relative_humidity_2m"],
        "WindSpeed_mps":               data["hourly"]["windspeed_10m"],
    })

    df["Time"] = pd.to_datetime(df["Time"])
    df = df.set_index("Time")

    return df.resample("10min").interpolate(method="linear")


# ==========================================================
# MAIN FORECAST ENTRY POINT
# ==========================================================

def run_lstm_forecast(mode, single_date=None, start_date=None, end_date=None):
    df = fetch_weather()

    # --- Select date range ---
    if mode == "single":
        selected = pd.to_datetime(single_date)
        df_selected = df[df.index.normalize() == selected].copy()
    else:
        start = pd.to_datetime(start_date)
        end   = pd.to_datetime(end_date)
        df_selected = df[
            (df.index.normalize() >= start) &
            (df.index.normalize() <= end)
        ].copy()

    if df_selected.empty:
        raise ValueError(
            "No weather data for the selected date(s). "
            "Open-Meteo provides up to 7 days of forecast from today."
        )

    # --- Load persisted LSTM state ---
    lstm_sequence, prev_power = _load_system_state()

    # --- Recursive LSTM forecasting ---
    predictions = []

    for i in range(len(df_selected)):
        row = df_selected.iloc[i]

        new_row = np.array([
            row["Irradiation_Avg"],
            row["Environment_Temperature_Avg"],
            row["WindSpeed_mps"],
            row["Humidity_%"],
            prev_power,
        ])

        lstm_sequence = np.vstack([lstm_sequence, new_row])[1:]
        scaled = scaler.transform(lstm_sequence).reshape(1, TIME_STEPS, -1)

        pred = float(lstm_model.predict(scaled, verbose=0)[0][0])
        pred = max(pred, 0.0)

        predictions.append(pred)
        prev_power = pred

    # --- Persist updated state for next call ---
    _save_system_state(lstm_sequence, prev_power)

    df_selected["Power_kW"] = predictions

    # --- Energy data for the chart ---
    if mode == "single":
        # 10-min power (kW) → hourly energy (kWh): sum of 6 intervals × DELTA_T
        hourly = df_selected["Power_kW"].resample("h").sum() * DELTA_T
        energy_data = [
            {"label": t.strftime("%H:00"), "energy": round(float(e), 4)}
            for t, e in zip(hourly.index, hourly.values)
        ]
    else:
        # 10-min power (kW) → daily energy (kWh)
        daily = df_selected["Power_kW"].resample("D").sum() * DELTA_T
        energy_data = [
            {"label": d.strftime("%Y-%m-%d"), "energy": round(float(e), 4)}
            for d, e in zip(daily.index, daily.values)
        ]

    # --- Unified table: weather averages + energy per period ---
    meteo_cols = [
        "Irradiation_Avg",
        "Environment_Temperature_Avg",
        "Humidity_%",
        "WindSpeed_mps",
    ]

    if mode == "single":
        period_meteo  = df_selected[meteo_cols].resample("h").mean()
        period_energy = df_selected["Power_kW"].resample("h").sum() * DELTA_T
        weather_summary = [
            {
                "label":       t.strftime("%H:00"),
                "temperature": round(float(period_meteo.loc[t, "Environment_Temperature_Avg"]), 2),
                "humidity":    round(float(period_meteo.loc[t, "Humidity_%"]), 2),
                "irradiance":  round(float(period_meteo.loc[t, "Irradiation_Avg"]), 2),
                "wind":        round(float(period_meteo.loc[t, "WindSpeed_mps"]), 2),
                "energy":      round(float(period_energy.loc[t]), 4),
            }
            for t in period_meteo.index
        ]
    else:
        period_meteo  = df_selected[meteo_cols].resample("D").mean()
        period_energy = df_selected["Power_kW"].resample("D").sum() * DELTA_T
        weather_summary = [
            {
                "label":       d.strftime("%Y-%m-%d"),
                "temperature": round(float(period_meteo.loc[d, "Environment_Temperature_Avg"]), 2),
                "humidity":    round(float(period_meteo.loc[d, "Humidity_%"]), 2),
                "irradiance":  round(float(period_meteo.loc[d, "Irradiation_Avg"]), 2),
                "wind":        round(float(period_meteo.loc[d, "WindSpeed_mps"]), 2),
                "energy":      round(float(period_energy.loc[d]), 4),
            }
            for d in period_meteo.index
        ]

    return {
        "energy_data":     energy_data,
        "weather_summary": weather_summary,
    }
