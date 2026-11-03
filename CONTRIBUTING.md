# Contributing to Weather Sentinel

Thank you for your interest in contributing to **Weather Sentinel**! We welcome contributions from meteorological researchers, GIS specialists, data engineers, frontend designers, and machine learning practitioners.

---

## 🛠️ Code of Conduct

Please review and adhere to our [Code of Conduct](CODE_OF_CONDUCT.md) in all interactions within this project.

---

## 🚀 Getting Started

1. **Fork the Repository** on GitHub: [https://github.com/abhimanyu1502/weather-sentinel](https://github.com/abhimanyu1502/weather-sentinel)
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/<your-username>/weather-sentinel.git
   cd weather-sentinel
   ```
3. **Create a new feature branch**:
   ```bash
   git checkout -b feature/my-cool-improvement
   ```

---

## 💻 Local Development Workflow

### 1. Backend (FastAPI + PyTorch)
```bash
cd backend
python -m venv .venv

# On Windows:
.venv\Scripts\activate
# On Linux / macOS:
source .venv/bin/activate

pip install -r requirements.txt
pip install pytest

# Run backend locally
python main.py
```
*Backend runs on `http://localhost:8000` with Swagger docs at `http://localhost:8000/docs`.*

### 2. Frontend (React 18 + Vite + TypeScript)
```bash
cd frontend
npm install

# Run Vite development server
npm run dev
```
*Frontend runs on `http://localhost:5173`.*

---

## 🧪 Testing & Code Quality

Before submitting a pull request, ensure all tests pass:

```bash
# Backend validation suite
cd backend
python tests/validation/run_all_checks.py

# Frontend type check & build
cd ../frontend
npm run build
```

---

## 📦 Pull Request Process

1. Keep commits focused, descriptive, and follow conventional commit formats (e.g. `feat: add radar filter`, `fix: map boundary padding`).
2. Update documentation if introducing new features, API routes, or configuration options.
3. Submit a Pull Request targeting the `main` branch.
