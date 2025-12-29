# Security Notice



### 1. Environment Variables Setup

This project requires the following environment variables:

- `MONGODB_URI` - MongoDB connection string (REQUIRED)
- `SECRET_KEY` - Flask session secret (REQUIRED for production)
- `GEOAPIFY_API_KEY` - Geocoding API key (optional)

See [.env.example](.env.example) for the template.

### 2. Never Commit Sensitive Data

The `.gitignore` file is configured to exclude:
- `.env` files
- `*.log` files
- Python cache files
- Other sensitive data

**Always verify before committing:**
```bash
git status
git diff --cached
```

### 3. For Contributors

If you're contributing to this project:
- Never commit API keys, passwords, or tokens
- Never commit log files
- Use environment variables for all sensitive configuration
- Review your commits before pushing

### Reporting Security Issues

If you discover a security vulnerability, please email the maintainer directly rather than opening a public issue.
