from ..schemas import AuthSessionResponse


def get_demo_session() -> AuthSessionResponse:
    return AuthSessionResponse(authenticated=False, user=None)
