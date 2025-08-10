# Setup Instructions

## Secrets: keep API keys out of GitHub

Never commit secrets. Use environment variables locally and in Vercel.

### Local development (macOS, zsh)

Option A — export in your shell for this session:

```bash
export GEOAPIFY_API_KEY="your_key_here"
export OTHER_SECRET="value"
python app.py
```

Option B — .env file (recommended):

1) Create a file named `.env` at the repo root:
```
GEOAPIFY_API_KEY=your_key_here
OTHER_SECRET=value
```
2) Ensure `.env` is git-ignored (see repo .gitignore)
3) App loads it via python-dotenv on startup

### Using secrets in Flask

Read from the environment when needed:

```python
import os
API_KEY = os.getenv("GEOAPIFY_API_KEY")
```

Optionally expose specific values to templates:

```python
app.config["GEOAPIFY_API_KEY"] = os.getenv("GEOAPIFY_API_KEY")
```

Do not embed true secrets in frontend JS. If the browser must call a third‑party API, prefer a backend proxy.

### Backend proxy pattern (recommended)

- Frontend calls your endpoint, e.g. `/api/geocode?q=London`
- Backend uses the secret key to call the provider and returns sanitized JSON
- Key never reaches the browser; rotate if needed in Vercel without redeploying code

### Vercel deployment

1) Add environment variables in Vercel Dashboard:
   - Project → Settings → Environment Variables
   - Add per Environment (Development, Preview, Production)
   - Names must match what your code expects (e.g., `GEOAPIFY_API_KEY`)
2) Deploy as usual. Vercel injects env vars at runtime.

Optional CLI:
```bash
vercel env add GEOAPIFY_API_KEY production
vercel env add GEOAPIFY_API_KEY preview
vercel env add GEOAPIFY_API_KEY development
```

### Frontend keys (if absolutely necessary)

- Use provider “public” keys only and restrict by domain/referrer in provider console
- Treat them as public; rotate if leaked
- Prefer the proxy pattern above for sensitive APIs

### Verify

- Locally: `print(bool(os.getenv("GEOAPIFY_API_KEY")))` should be True when set
- On Vercel: use Logs to confirm it’s present (avoid printing actual values)

### Notes

- This repo loads `.env` automatically via python‑dotenv
- `.env` and `.env.*.local` are ignored by Git
