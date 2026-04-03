from fastapi import FastAPI

from .routes import admin, auth, health


app = FastAPI(title="{{PROJECT_NAME}} API")
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(admin.router)
