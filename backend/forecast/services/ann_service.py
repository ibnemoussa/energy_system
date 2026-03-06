import os
import requests
import pandas as pd
import numpy as np
import joblib
from keras.models import load_model
from django.conf import settings

# --- Model directory ---
ANN_DIR = getattr(
    settings,
    "ANN_MODEL_DIR",
    os.path.join(
        os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
        "ANN", "models"
    ),
)

# Load at startup (once)
ann_model = load_model(os.path.join(ANN_DIR, "ann_standard_model.keras"))
scaler    = joblib.load(os.path.join(ANN_DIR, "standard_scaler.pkl"))
features  = joblib.load(os.path.join(ANN_DIR, "ann_features.pkl"))
# features = ['Irradiation_Avg', 'Environment_Temperature_Avg', 'WindSpeed_mps', 'Humidity_%']

LAT     = -2.0261
LON     = 30.3772
DELTA_T = 10 / 60  # 10-minute intervals → hours


# ==========================================================
# WEATHER FETCH (Open-Meteo, 7-day hourly → 10-min interpolated)
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

def run_ann_forecast(mode, single_date=None, start_date=None, end_date=None):
    df = fetch_weather()

    # --- Select date range ---
    if mode == "single":
        selected    = pd.to_datetime(single_date)
        df_selected = df[df.index.normalize() == selected].copy()
    else:
        start       = pd.to_datetime(start_date)
        end         = pd.to_datetime(end_date)
        df_selected = df[
            (df.index.normalize() >= start) &
            (df.index.normalize() <= end)
        ].copy()

    if df_selected.empty:
        raise ValueError(
            "No weather data for the selected date(s). "
            "Open-Meteo provides up to 7 days of forecast from today."
        )

    # --- ANN inference: stateless row-by-row prediction ---
    X        = df_selected[features].values          # shape (N, 4)
    X_scaled = scaler.transform(X)
    preds    = ann_model.predict(X_scaled, verbose=0).flatten()
    preds    = np.maximum(preds, 0.0)

    df_selected["Power_kW"] = preds

    # --- Energy data for the chart ---
    if mode == "single":
        hourly     = df_selected["Power_kW"].resample("h").sum() * DELTA_T
        energy_data = [
            {"label": t.strftime("%H:00"), "energy": round(float(e), 4)}
            for t, e in zip(hourly.index, hourly.values)
        ]
    else:
        daily      = df_selected["Power_kW"].resample("D").sum() * DELTA_T
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
