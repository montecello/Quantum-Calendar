# Quantum Clock v1.0 ⏰

A location-aware astronomical calendar anchored to real celestial events: dawn, the exact 100% full moon, and Spica-based astronomical rules. This web application integrates lunar cycles, solar events, Hebrew language etymology, and ancient festival observances into an interactive calendar system.

## ✨ Features

### 🌙 Astronomical Calendar
- **Location-aware calculations** - All times and events calculated for your specific coordinates
- **Lunar months** - Month boundaries based on astronomical new moons
- **Solar year markers** - Years beginning from vernal equinox and Spica alignments
- **Real-time celestial data** - Dawn/dusk times, moon phases, planetary positions
- **Multi-year view** - Navigate and plan across multiple years

### 📖 Hebrew Language Tools
- **The Letters** - Interactive exploration of Hebrew letter meanings, numerical values (gematria), and astronomical symbolism
- **Primitive Roots** - Deep dive into Strong's Concordance Hebrew words with etymology chains and primitive root analysis
- **KJV Integration** - Biblical verse references with Hebrew word connections

### 📅 Festival Calendar
- Ancient Hebrew festival dates calculated astronomically
- Integration with lunar calendar system
- Historical and cultural context for each observance

### 🎨 Interactive UI
- Animated matrix rain background
- Responsive calendar grid with touch/hover interactions
- Expandable side panels with detailed astronomical data
- Dark theme optimized for readability

## 🚀 Quick Start

### Prerequisites
- Python 3.10 or higher
- pip package manager
- MongoDB Atlas account (for Hebrew/KJV data)

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/montecello/Quantum-Calendar.git
cd Quantum-Calendar
```

2. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your credentials (see Configuration section)
```

3. **Install dependencies**
```bash
pip install -r requirements.txt
```

4. **Run the application**
```bash
python app.py
```

5. **Open in browser**
Navigate to `http://127.0.0.1:5001` (or the URL shown in terminal)

## ⚙️ Configuration

Create a `.env` file with the following variables:

```bash
# MongoDB (Required for Hebrew/KJV features)
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
DATABASE_NAME=quantum-calendar
STRONG_COLLECTION=strongs
KJV_COLLECTION=verses

# Flask
SECRET_KEY=your-secret-key-here
FLASK_ENV=development

# Geoapify (Optional - for geocoding)
GEOAPIFY_API_KEY=your-api-key-here

# Astronomy Service
ASTRO_API_BASE=http://localhost:8001
```

See [`.env.example`](.env.example) for a complete template.

## 🌐 Deployment

This application is deployed on Vercel with the following structure:

- **Main App**: Flask application serving calendar and Hebrew tools
- **Astro Service**: Separate microservice for intensive astronomical calculations (deployed independently)

### Vercel Setup
1. Import repository to Vercel
2. Add environment variables in project settings
3. Deploy automatically on push to main branch

## 📂 Project Structure

```
Quantum-Calendar/
├── app.py                 # Main Flask application
├── config.py              # Configuration management
├── requirements.txt       # Python dependencies
├── vercel.json           # Vercel deployment config
├── frontend/
│   ├── templates/        # HTML templates
│   │   ├── index.html         # Main calendar interface
│   │   ├── the_letters.html   # Hebrew letters explorer
│   │   ├── primitive_roots.html # Etymology tool
│   │   ├── festivals.html     # Festival calendar
│   │   └── ...
│   └── static/           # CSS, JS, images, fonts
├── backend/
│   ├── routes.py         # API endpoints
│   ├── astronomy/        # Astronomical calculations
│   ├── data/             # Data loading and management
│   └── geolocation/      # Location services
└── astro-service/        # Separate astronomy microservice
```

## 🎯 Usage

### Calendar Navigation
1. **Set Location** - Click location icon or search for a place
2. **Browse Time** - Use arrow buttons to navigate months/years
3. **View Details** - Click any date to see detailed astronomical data
4. **Special Days** - Look for highlighted cells (New Moon 🌕, Ideal Rest Days, festivals)

### Hebrew Tools
1. **The Letters** - Explore Hebrew alphabet with astronomical and numerical meanings
2. **Primitive Roots** - Search Strong's numbers or Hebrew words to trace etymology
3. **Festivals** - View calculated dates for ancient Hebrew observances

## 🔒 Security

See [SECURITY.md](SECURITY.md) for:
- Environment variable setup
- Security best practices
- Contribution guidelines

## 📜 License

This project integrates data from:
- Skyfield (astronomical calculations)
- Strong's Hebrew Concordance (public domain)
- King James Version Bible (public domain)

## 🙏 Acknowledgments

Built with:
- [Flask](https://flask.palletsprojects.com/) - Web framework
- [Skyfield](https://rhodesmill.org/skyfield/) - Astronomical calculations
- [MongoDB](https://www.mongodb.com/) - Database
- [Vercel](https://vercel.com/) - Hosting platform