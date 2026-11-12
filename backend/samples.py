"""Deterministic, clearly synthetic practice datasets (seeded, so results are reproducible)."""
from __future__ import annotations

from functools import lru_cache

import numpy as np
import pandas as pd

SEED = 20240601
CATALOG = {
    "Furniture": [("Chair", 120, .18), ("Desk", 340, .22), ("Bookcase", 210, .15), ("Table", 280, .20)],
    "Technology": [("Laptop", 900, .14), ("Phone", 600, .16), ("Monitor", 250, .19), ("Keyboard", 60, .28)],
    "Office Supplies": [("Paper", 20, .35), ("Binder", 15, .30), ("Pen Set", 12, .40), ("Stapler", 25, .33)],
}
REGIONS, REGION_W = ["North", "South", "East", "West"], [.28, .22, .24, .26]
SEGMENTS, SEGMENT_W = ["Consumer", "Corporate", "Home Office"], [.52, .30, .18]
CITIES = ["Hyderabad", "Bengaluru", "Chennai", "Mumbai", "Delhi", "Pune", "Kolkata", "Ahmedabad"]
MONTH_W = np.array([.8, .8, .9, .9, 1, 1, .95, 1, 1.1, 1.2, 1.5, 1.6])


def _rng(offset=0):
    return np.random.default_rng(SEED + offset)


@lru_cache(maxsize=1)
def customers_raw() -> pd.DataFrame:
    r, n = _rng(1), 400
    signup = pd.Timestamp("2022-01-01") + pd.to_timedelta(r.integers(0, 900, n), unit="D")
    return pd.DataFrame({"customer_id": [f"C{i:04d}" for i in range(1, n + 1)],
                         "customer_name": [f"Customer {i:04d}" for i in range(1, n + 1)],
                         "segment": r.choice(SEGMENTS, n, p=SEGMENT_W), "city": r.choice(CITIES, n),
                         "signup_date": signup.strftime("%Y-%m-%d")})


@lru_cache(maxsize=1)
def orders_raw() -> pd.DataFrame:
    r, n = _rng(2), 1500
    days = pd.date_range("2023-01-01", "2024-12-31")
    w = MONTH_W[days.month - 1]
    dates = r.choice(days, n, p=w / w.sum())
    cat = r.choice(list(CATALOG), n, p=[.25, .30, .45])
    prod, price, margin = [], [], []
    for c in cat:
        p, pr, m = CATALOG[c][r.integers(0, 4)]
        prod.append(p); price.append(pr); margin.append(m)
    qty = np.clip(r.geometric(.35, n), 1, 10)
    disc = r.choice([0, 0, 0, .1, .2, .3], n)
    sales = np.round(np.array(price) * qty * (1 - disc) * r.uniform(.95, 1.05, n), 2)
    profit = np.round(sales * (np.array(margin) - disc * .9) + r.normal(0, 4, n), 2)
    df = pd.DataFrame({"order_id": [f"O-{10000 + i}" for i in range(n)], "order_date": pd.to_datetime(dates).strftime("%Y-%m-%d"),
                       "customer_id": r.choice(customers_raw()["customer_id"], n), "region": r.choice(REGIONS, n, p=REGION_W),
                       "category": cat, "product": prod, "sales": sales, "profit": profit, "quantity": qty})
    return df.sort_values(["order_date", "order_id"]).reset_index(drop=True)


def retail() -> pd.DataFrame:
    o = orders_raw().merge(customers_raw()[["customer_id", "segment"]], on="customer_id")
    return o.rename(columns={"category": "product_category", "segment": "customer_segment"})[
        ["order_id", "order_date", "region", "product_category", "product", "sales", "profit", "quantity", "customer_segment"]]


def customers() -> pd.DataFrame:
    o = orders_raw()
    g = o.groupby("customer_id").agg(orders=("order_id", "count"), total_sales=("sales", "sum"), total_profit=("profit", "sum"),
                                     last_order_date=("order_date", "max")).reset_index()
    df = customers_raw().drop(columns=["customer_name"]).merge(g, on="customer_id", how="left")
    df[["orders", "total_sales", "total_profit"]] = df[["orders", "total_sales", "total_profit"]].fillna(0)
    df["total_sales"], df["total_profit"] = df["total_sales"].round(2), df["total_profit"].round(2)
    return df


@lru_cache(maxsize=1)
def _hr() -> pd.DataFrame:
    r, n = _rng(3), 420
    dept = r.choice(["Sales", "Engineering", "HR", "Finance", "Support", "Marketing"], n)
    level = r.choice(["Junior", "Mid", "Senior", "Lead"], n, p=[.35, .35, .2, .1])
    base = {"Sales": 38, "Engineering": 55, "HR": 36, "Finance": 45, "Support": 30, "Marketing": 40}
    mult = {"Junior": 1, "Mid": 1.35, "Senior": 1.8, "Lead": 2.3}
    age = np.clip(r.normal(34, 8, n), 22, 60).astype(int)
    tenure = np.clip((age - 22) * r.uniform(.1, .7, n), 0, 30).round(1)
    sat, overtime = r.integers(1, 6, n), r.choice(["Yes", "No"], n, p=[.3, .7])
    p_att = np.clip(.28 - .05 * sat + np.where(overtime == "Yes", .1, 0), .02, .6)
    return pd.DataFrame({"employee_id": [f"E{i:04d}" for i in range(1, n + 1)], "department": dept, "job_level": level, "age": age,
                         "tenure_years": tenure, "salary_k": np.round([base[d] * mult[l] * 1000 * u / 1000 for d, l, u in zip(dept, level, r.uniform(.9, 1.15, n))], 1),
                         "performance_rating": r.integers(1, 6, n), "satisfaction": sat, "overtime": overtime,
                         "attrition": np.where(r.random(n) < p_att, "Yes", "No")})


def hr() -> pd.DataFrame:
    return _hr().copy()


def finance() -> pd.DataFrame:
    r, rows = _rng(4), []
    for m in pd.date_range("2023-01-01", periods=24, freq="MS"):
        for d, base in {"Sales": 500, "Marketing": 220, "Operations": 380, "R&D": 260}.items():
            rev = base * (1 + .015 * (m.month - 1 + 12 * (m.year - 2023))) * r.uniform(.9, 1.12)
            cost = rev * r.uniform(.62, .9)
            rows.append({"month": m.strftime("%Y-%m-%d"), "department": d, "revenue_k": round(rev, 1), "cost_k": round(cost, 1), "budget_k": round(rev * r.uniform(.95, 1.05), 1)})
    return pd.DataFrame(rows)


def accidents() -> pd.DataFrame:
    r, n = _rng(5), 900
    dates = pd.to_datetime(r.choice(pd.date_range("2022-01-01", "2024-12-31"), n))
    road = r.choice(["Highway", "Urban Road", "Rural Road", "Junction"], n, p=[.25, .35, .2, .2])
    weather = r.choice(["Clear", "Rain", "Fog", "Cloudy"], n, p=[.55, .2, .1, .15])
    hour = np.clip(r.normal(15, 6, n), 0, 23).astype(int)
    risk = .08 + (road == "Highway") * .1 + (weather == "Fog") * .08 + ((hour >= 22) | (hour <= 4)) * .08
    sev = np.where(r.random(n) < risk, "Fatal", np.where(r.random(n) < .35, "Serious", "Minor"))
    veh = r.integers(1, 5, n)
    cas = np.where(sev == "Fatal", r.integers(1, 4, n), np.where(sev == "Serious", r.integers(1, 3, n), r.integers(0, 2, n)))
    return pd.DataFrame({"accident_id": [f"A{i:05d}" for i in range(1, n + 1)], "date": dates.strftime("%Y-%m-%d"), "city": r.choice(CITIES[:6], n),
                         "road_type": road, "weather": weather, "hour": hour, "vehicles_involved": veh, "casualties": cas, "severity": sev}).sort_values("date").reset_index(drop=True)


SAMPLES = {
    "retail": ("Retail sales (synthetic)", "1,500 orders across 4 regions, 3 categories and 3 customer segments, 2023–2024.", retail),
    "customers": ("Customers (synthetic)", "400 customers with order counts and lifetime sales/profit, for segmentation.", customers),
    "hr": ("HR analytics (synthetic)", "420 employees with salary, satisfaction, overtime and attrition.", hr),
    "finance": ("Department finance (synthetic)", "24 months × 4 departments: revenue, cost and budget (in thousands).", finance),
    "accidents": ("Road accidents (synthetic)", "900 accident records with road type, weather, hour and severity.", accidents),
}


def info() -> list[dict]:
    out = []
    for k, (t, d, f) in SAMPLES.items():
        df = _cached(k)
        out.append({"key": k, "title": t, "description": d, "rows": len(df), "columns": list(df.columns), "synthetic": True})
    return out


@lru_cache(maxsize=8)
def _cached(key: str) -> pd.DataFrame:
    return SAMPLES[key][2]()


def get(key: str) -> pd.DataFrame:
    if key not in SAMPLES:
        raise KeyError(key)
    return _cached(key).copy()
