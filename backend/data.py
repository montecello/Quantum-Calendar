"""
Lightweight data loader that avoids a hard pandas dependency.

- Uses pandas if available locally (dev).
- Falls back to a minimal DataFrame/Series built on csv for serverless (Vercel).
- Exposes the same globals and loader functions used by backend.astronomy.*.
"""

from __future__ import annotations
import os
import csv
import logging
from typing import Any, Dict, List, Optional

logging.basicConfig(level=logging.INFO)

# Optional pandas for local/dev; on Vercel we fall back automatically
try:  # pragma: no cover
    import pandas as pd  # type: ignore
except Exception:  # pragma: no cover
    pd = None  # type: ignore


# -------------------------------
# Resolve data directory robustly
# -------------------------------
def _pick_data_dir() -> str:
    here = os.path.dirname(__file__)
    candidates = [
        os.path.join(here, "data"),                     # backend/data
        os.path.join(os.path.dirname(here), "data"),    # <repo>/data
    ]
    for d in candidates:
        if os.path.isdir(d):
            logging.info("Using DATA_DIR: %s", d)
            return d
    fallback = candidates[0]
    logging.warning("No data dir found; defaulting to %s", fallback)
    return fallback


DATA_DIR = _pick_data_dir()
FULL_MOON_CSV = os.path.join(DATA_DIR, "full_moon_times.csv")
NEW_YEARS_CSV = os.path.join(DATA_DIR, "new_years_day.csv")
SPICA_MOON_CSV = os.path.join(DATA_DIR, "spica_moon_crossings.csv")
SUN_HAMAL_CSV = os.path.join(DATA_DIR, "sun_hamal_crossings.csv")


# -------------------------------
# Minimal DataFrame/Series fallback
# -------------------------------
class _BoolMask:
    def __init__(self, values: List[bool]):
        self.values = values
    def __and__(self, other: "_BoolMask") -> "_BoolMask":
        return _BoolMask([a and b for a, b in zip(self.values, other.values)])


class _Series:
    def __init__(self, data: List[Any]):
        self._data = list(data)
    # functional
    def apply(self, fn):
        return _Series([fn(x) for x in self._data])
    # iteration and len
    def __iter__(self):
        return iter(self._data)
    def __len__(self):
        return len(self._data)
    # comparisons -> boolean masks
    def __le__(self, other) -> _BoolMask:
        return _BoolMask([x <= other for x in self._data])
    def __lt__(self, other) -> _BoolMask:
        return _BoolMask([x < other for x in self._data])
    def __ge__(self, other) -> _BoolMask:
        return _BoolMask([x >= other for x in self._data])
    def __gt__(self, other) -> _BoolMask:
        return _BoolMask([x > other for x in self._data])
    # mask indexing
    def __getitem__(self, mask: _BoolMask) -> "_Series":
        return _Series([x for x, m in zip(self._data, mask.values) if m])
    # reductions/exports
    def max(self):
        return max(self._data) if self._data else None
    def min(self):
        return min(self._data) if self._data else None
    def tolist(self) -> List[Any]:
        return list(self._data)


class _DataFrame:
    def __init__(self, columns: Dict[str, List[Any]]):
        self._cols = columns
    def __len__(self) -> int:
        if not self._cols:
            return 0
        first_key = next(iter(self._cols))
        return len(self._cols[first_key])
    def __getitem__(self, key: str) -> _Series:
        return _Series(self._cols.get(key, []))


def _read_csv_as_fallback_df(path: str) -> _DataFrame:
    cols: Dict[str, List[Any]] = {}
    try:
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for field in reader.fieldnames or []:
                cols[field] = []
            for row in reader:
                for field, value in row.items():
                    cols[field].append(value)
    except FileNotFoundError:
        logging.error("CSV not found: %s", path)
    return _DataFrame(cols)


# -------------------------------
# Public datasets and loaders
# -------------------------------
full_moon_times: Optional[Any] = None
new_years_days: Optional[Any] = None
spica_moon_crossings: Optional[Any] = None
sun_hamal_crossings: Optional[Any] = None


def _read_csv(path: str):
    """Read CSV via pandas if available, else use fallback."""
    if pd is not None:
        try:
            return pd.read_csv(path)
        except Exception as e:  # fall back if pandas chokes
            logging.warning("pandas read failed (%s); using fallback for %s", e, path)
    return _read_csv_as_fallback_df(path)


def load_full_moon_times():
    global full_moon_times
    logging.info("Loading: %s", FULL_MOON_CSV)
    full_moon_times = _read_csv(FULL_MOON_CSV)
    logging.info(
        "Loaded full_moon_times rows: %s",
        len(full_moon_times) if hasattr(full_moon_times, "__len__") else "unknown",
    )
    return full_moon_times


def load_new_years_days():
    global new_years_days
    logging.info("Loading: %s", NEW_YEARS_CSV)
    new_years_days = _read_csv(NEW_YEARS_CSV)
    logging.info(
        "Loaded new_years_day rows: %s",
        len(new_years_days) if hasattr(new_years_days, "__len__") else "unknown",
    )
    return new_years_days


def load_spica_moon_crossings():
    global spica_moon_crossings
    logging.info("Loading: %s", SPICA_MOON_CSV)
    spica_moon_crossings = _read_csv(SPICA_MOON_CSV)
    logging.info(
        "Loaded spica_moon_crossings rows: %s",
        len(spica_moon_crossings) if hasattr(spica_moon_crossings, "__len__") else "unknown",
    )
    return spica_moon_crossings


def load_sun_hamal_crossings():
    global sun_hamal_crossings
    logging.info("Loading: %s", SUN_HAMAL_CSV)
    sun_hamal_crossings = _read_csv(SUN_HAMAL_CSV)
    logging.info(
        "Loaded sun_hamal_crossings rows: %s",
        len(sun_hamal_crossings) if hasattr(sun_hamal_crossings, "__len__") else "unknown",
    )
    return sun_hamal_crossings


def load_all_data():
    logging.info("--- Loading astronomical data files ---")
    load_full_moon_times()
    load_new_years_days()
    load_spica_moon_crossings()
    load_sun_hamal_crossings()
    logging.info("--- All data files loaded ---")
"""
Data handling for astronomical CSVs without a hard pandas dependency.

This module provides the same globals and loader functions consumed by
backend.astronomy.* modules, but uses a lightweight fallback DataFrame/Series
when pandas isn’t available (e.g., on Vercel).
"""

import os
import csv
from typing import Any, Dict, List, Optional

# Try optional pandas for local/dev; fallback to lightweight structures on Vercel
try:  # pragma: no cover - optional
    import pandas as pd  # type: ignore
except Exception:  # pragma: no cover - pandas missing in serverless
    pd = None  # type: ignore


# -------------------------------
# Paths
# -------------------------------
DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'data')

FULL_MOON_CSV = os.path.join(DATA_DIR, 'full_moon_times.csv')
NEW_YEARS_CSV = os.path.join(DATA_DIR, 'new_years_day.csv')
SPICA_MOON_CSV = os.path.join(DATA_DIR, 'spica_moon_crossings.csv')
SUN_HAMAL_CSV = os.path.join(DATA_DIR, 'sun_hamal_crossings.csv')


# -------------------------------
# Lightweight DataFrame/Series fallback
# -------------------------------
class _BoolMask:
    def __init__(self, values: List[bool]):
        self.values = values

    def __and__(self, other: "_BoolMask") -> "_BoolMask":
        return _BoolMask([a and b for a, b in zip(self.values, other.values)])


class _Series:
    def __init__(self, data: List[Any]):
        self._data = list(data)

    # functional
    def apply(self, fn):
        return _Series([fn(x) for x in self._data])

    # iteration and len
    def __iter__(self):
        return iter(self._data)

    def __len__(self):
        return len(self._data)

    # comparisons -> boolean masks
    def __le__(self, other) -> _BoolMask:
        return _BoolMask([x <= other for x in self._data])

    def __lt__(self, other) -> _BoolMask:
        return _BoolMask([x < other for x in self._data])

    def __ge__(self, other) -> _BoolMask:
        return _BoolMask([x >= other for x in self._data])

    def __gt__(self, other) -> _BoolMask:
        return _BoolMask([x > other for x in self._data])

    # indexing by boolean mask
    def __getitem__(self, mask: _BoolMask) -> "_Series":
        return _Series([x for x, m in zip(self._data, mask.values) if m])

    # reductions
    def max(self):
        return max(self._data) if self._data else None

    def min(self):
        return min(self._data) if self._data else None

    def tolist(self) -> List[Any]:
        return list(self._data)


class _DataFrame:
    def __init__(self, columns: Dict[str, List[Any]]):
        self._cols = columns

    def __len__(self) -> int:
        if not self._cols:
            return 0
        first_key = next(iter(self._cols))
        return len(self._cols[first_key])

    def __getitem__(self, key: str) -> _Series:
        return _Series(self._cols.get(key, []))


def _read_csv_as_fallback_df(path: str) -> _DataFrame:
    cols: Dict[str, List[Any]] = {}
    with open(path, newline='', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        # Initialize columns
        for field in reader.fieldnames or []:
            cols[field] = []
        for row in reader:
            for field, value in row.items():
                cols[field].append(value)
    return _DataFrame(cols)


# -------------------------------
# Module-level datasets (DataFrame-like)
# -------------------------------
full_moon_times: Optional[Any] = None
new_years_days: Optional[Any] = None
"""
Data handling for astronomical CSVs without a hard pandas dependency.

This module exposes the same globals and loader functions used by
backend.astronomy.* but avoids pandas on platforms with tight size limits
by providing a lightweight DataFrame/Series fallback using the csv module.
"""

from typing import Any, Dict, List, Optional
import os
import csv
import logging

logging.basicConfig(level=logging.INFO)

# Optional pandas for local/dev; on Vercel we fall back automatically
try:  # pragma: no cover
    import pandas as pd  # type: ignore
except Exception:  # pragma: no cover
    pd = None  # type: ignore


# -------------------------------
# Resolve data directory robustly
# -------------------------------
def _pick_data_dir() -> str:
    here = os.path.dirname(__file__)
    candidates = [
        os.path.join(here, "data"),                      # backend/data
        os.path.join(os.path.dirname(here), "data"),     # <repo>/data
    ]
    for d in candidates:
        if os.path.isdir(d):
            logging.info("Using DATA_DIR: %s", d)
            return d
    # Default to backend/data even if missing to keep paths consistent
    fallback = candidates[0]
    logging.warning("No data dir found; defaulting to %s", fallback)
    return fallback


DATA_DIR = _pick_data_dir()

FULL_MOON_CSV = os.path.join(DATA_DIR, 'full_moon_times.csv')
NEW_YEARS_CSV = os.path.join(DATA_DIR, 'new_years_day.csv')
SPICA_MOON_CSV = os.path.join(DATA_DIR, 'spica_moon_crossings.csv')
SUN_HAMAL_CSV = os.path.join(DATA_DIR, 'sun_hamal_crossings.csv')


# -------------------------------
# Lightweight DataFrame/Series fallback
# -------------------------------
class _BoolMask:
    def __init__(self, values: List[bool]):
        self.values = values

    def __and__(self, other: "_BoolMask") -> "_BoolMask":
        return _BoolMask([a and b for a, b in zip(self.values, other.values)])


class _Series:
    def __init__(self, data: List[Any]):
        self._data = list(data)

    # functional
    def apply(self, fn):
        return _Series([fn(x) for x in self._data])

    # iteration and len
    def __iter__(self):
        return iter(self._data)

    def __len__(self):
        return len(self._data)

    # comparisons -> boolean masks
    def __le__(self, other) -> _BoolMask:
        return _BoolMask([x <= other for x in self._data])

    def __lt__(self, other) -> _BoolMask:
        return _BoolMask([x < other for x in self._data])

    def __ge__(self, other) -> _BoolMask:
        return _BoolMask([x >= other for x in self._data])

    def __gt__(self, other) -> _BoolMask:
        return _BoolMask([x > other for x in self._data])

    # indexing by boolean mask
    def __getitem__(self, mask: _BoolMask) -> "_Series":
        return _Series([x for x, m in zip(self._data, mask.values) if m])

    # reductions
    def max(self):
        return max(self._data) if self._data else None

    def min(self):
        return min(self._data) if self._data else None

    def tolist(self) -> List[Any]:
        return list(self._data)


class _DataFrame:
    def __init__(self, columns: Dict[str, List[Any]]):
        self._cols = columns

    def __len__(self) -> int:
        if not self._cols:
            return 0
        first_key = next(iter(self._cols))
        return len(self._cols[first_key])

    def __getitem__(self, key: str) -> _Series:
        return _Series(self._cols.get(key, []))


def _read_csv_as_fallback_df(path: str) -> _DataFrame:
    cols: Dict[str, List[Any]] = {}
    try:
        with open(path, newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for field in reader.fieldnames or []:
                cols[field] = []
            for row in reader:
                for field, value in row.items():
                    cols[field].append(value)
    except FileNotFoundError:
        logging.error("CSV not found: %s", path)
    return _DataFrame(cols)


# -------------------------------
# Module-level datasets (DataFrame-like)
# -------------------------------
full_moon_times: Optional[Any] = None
new_years_days: Optional[Any] = None
spica_moon_crossings: Optional[Any] = None
sun_hamal_crossings: Optional[Any] = None


def _read_csv(path: str):
    """Read CSV via pandas if available, else use fallback."""
    if pd is not None:
        try:
            return pd.read_csv(path)
        except Exception as e:  # fall back if pandas chokes
            logging.warning("pandas read failed (%s); using fallback for %s", e, path)
    return _read_csv_as_fallback_df(path)


def load_full_moon_times():
    global full_moon_times
    logging.info("Loading: %s", FULL_MOON_CSV)
    full_moon_times = _read_csv(FULL_MOON_CSV)
    logging.info("Loaded full_moon_times rows: %s", len(full_moon_times) if hasattr(full_moon_times, "__len__") else "unknown")
    return full_moon_times


def load_new_years_days():
    global new_years_days
    logging.info("Loading: %s", NEW_YEARS_CSV)
    new_years_days = _read_csv(NEW_YEARS_CSV)
    logging.info("Loaded new_years_day rows: %s", len(new_years_days) if hasattr(new_years_days, "__len__") else "unknown")
    return new_years_days


def load_spica_moon_crossings():
    global spica_moon_crossings
    logging.info("Loading: %s", SPICA_MOON_CSV)
    spica_moon_crossings = _read_csv(SPICA_MOON_CSV)
    logging.info("Loaded spica_moon_crossings rows: %s", len(spica_moon_crossings) if hasattr(spica_moon_crossings, "__len__") else "unknown")
    return spica_moon_crossings


def load_sun_hamal_crossings():
    global sun_hamal_crossings
    logging.info("Loading: %s", SUN_HAMAL_CSV)
    sun_hamal_crossings = _read_csv(SUN_HAMAL_CSV)
    logging.info("Loaded sun_hamal_crossings rows: %s", len(sun_hamal_crossings) if hasattr(sun_hamal_crossings, "__len__") else "unknown")
    return sun_hamal_crossings


def load_all_data():
    logging.info("--- Loading astronomical data files ---")
    load_full_moon_times()
    load_new_years_days()
    load_spica_moon_crossings()
    load_sun_hamal_crossings()
    logging.info("--- All data files loaded ---")
