# Contributing

## Workflow

- use `develop` as the active integration branch
- keep changes scoped to one purpose when possible
- prefer small, reviewable batches over unrelated mixed changes
- keep the product centered on the main deploy path described in [PROJECT-RULES.md](PROJECT-RULES.md)
- do not add new top-level product complexity unless it clearly improves that main path

## Local setup

Backend:

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Checks

Frontend-focused changes:

```bash
npm --prefix frontend run smoke:beginner
npm --prefix frontend run smoke:admin
npm --prefix frontend run build
```

If the change does not touch `/app`, `/app/server-review`, or `/app/deployment-workflow`, you can skip `smoke:beginner`.

Backend-focused changes:

```bash
python3 -m py_compile backend/app/main.py backend/app/routes/*.py backend/app/services/*.py backend/app/db.py backend/app/schemas.py
PYTHONPATH=backend backend/venv/bin/python -m unittest discover -s backend/tests -p 'test_*.py'
```

Shared release check:

```bash
./scripts/preflight.sh
```

## Release posture

- prefer the smallest possible deploy surface
- use `frontend-only` and `backend-only` deploys when possible
- use the full stack flow only when compose settings, backend, and frontend build-time behavior changed together
- always run the post-deploy smoke after a production release

See [RUNBOOK.md](RUNBOOK.md) and [SAFE-RELEASE.md](SAFE-RELEASE.md) for the operator flow.
