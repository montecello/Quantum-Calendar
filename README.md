# Custom Astronomical Calendar Web App

A lunar-first calendar anchored to real astronomy: dawn, the exact 100% full moon, and Spica-based rules. Enter a location to generate a location-aware calendar where months and years begin from astronomical events, with special days clearly highlighted.

## Quick start
- Requires Python 3.10+ and pip
```bash
pip install -r requirements.txt
python3 app.py
```
Open the URL printed in your terminal (usually http://127.0.0.1:5000).

## Testing API Endpoints

Before deploying to Vercel, test your API endpoints locally:

```bash
# Test all API endpoints
python3 test_api_endpoints.py

# Or test against a specific URL
python3 test_api_endpoints.py https://your-app.vercel.app
```

This will test:
- `/api/test-mongodb` - MongoDB connection status
- `/api/debug` - Environment and configuration info
- `/api/strongs-data` - Strong's Hebrew data endpoint
- `/api/kjv-data` - KJV verses data endpoint

## Troubleshooting MongoDB Issues

If API endpoints are failing in Vercel:

1. **Check Vercel Environment Variables**:
   - `MONGODB_URI` - Your MongoDB Atlas connection string
   - `DATABASE_NAME` - Database name in MongoDB
   - `STRONG_COLLECTION` - Collection name for Strong's data
   - `KJV_COLLECTION` - Collection name for KJV data

2. **Test MongoDB Connection**:
   - Visit `https://your-app.vercel.app/api/test-mongodb`
   - Check the response for connection status and troubleshooting tips

3. **Verify MongoDB Atlas Configuration**:
   - Ensure IP whitelist includes `0.0.0.0/0` for Vercel
   - Check database user has read/write permissions
   - Verify cluster is running and accessible

4. **Check Logs**:
   - View Vercel function logs for detailed error messages
   - Look for connection timeouts or authentication failures

5. **Fallback Behavior**:
   - If MongoDB fails, endpoints automatically fall back to static JSON files
   - Static files are located in `frontend/static/data/`

## API Endpoints

- `/api/strongs-data` - Returns Strong's Hebrew dictionary data
- `/api/kjv-data` - Returns KJV Bible verses
- `/api/test-mongodb` - Tests MongoDB connection and returns status
- `/api/debug` - Returns environment and configuration information