FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY app ./app

# Download ephemeris at build time into the image
RUN python - <<'PY'
from skyfield.api import Loader
import os
p='app/data'
os.makedirs(p, exist_ok=True)
Loader(p)('de421.bsp')
PY

ENV CORS_ALLOW_ORIGINS=*
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
