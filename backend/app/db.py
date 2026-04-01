import os
import hashlib
import json
import secrets
import uuid
from datetime import datetime, timezone
from typing import Any

import psycopg
from fastapi import HTTPException


DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://deploymate:deploymate@127.0.0.1:5433/deploymate",
)


def _hash_password(password: str, salt: str | None = None) -> str:
    password_salt = salt or secrets.token_hex(16)
    password_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        password_salt.encode("utf-8"),
        100000,
    ).hex()
    return f"{password_salt}${password_hash}"


def _verify_password(password: str, password_hash: str) -> bool:
    try:
        salt, expected_hash = password_hash.split("$", 1)
    except ValueError:
        return False

    candidate_hash = _hash_password(password, salt).split("$", 1)[1]
    return secrets.compare_digest(candidate_hash, expected_hash)


def get_db_connection() -> psycopg.Connection:
    try:
        return psycopg.connect(DATABASE_URL)
    except psycopg.Error as exc:
        raise HTTPException(status_code=500, detail=f"Database connection failed: {exc}") from exc


def init_db() -> None:
    create_users_table_sql = """
    CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        plan TEXT NOT NULL DEFAULT 'trial',
        role TEXT NOT NULL DEFAULT 'member',
        must_change_password BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL
    );
    """

    alter_users_add_must_change_password_sql = """
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
    """

    alter_users_add_plan_sql = """
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'trial';
    """

    alter_users_add_role_sql = """
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'member';
    """

    create_sessions_table_sql = """
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL
    );
    """

    create_servers_table_sql = """
    CREATE TABLE IF NOT EXISTS servers (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        username TEXT NOT NULL,
        auth_type VARCHAR(32) NOT NULL,
        password TEXT NULL,
        ssh_key TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL
    );
    """

    create_deployments_table_sql = """
    CREATE TABLE IF NOT EXISTS deployments (
        id UUID PRIMARY KEY,
        status VARCHAR(32) NOT NULL,
        image TEXT NOT NULL,
        container_name TEXT NOT NULL,
        container_id TEXT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        error TEXT NULL,
        internal_port INTEGER NULL,
        external_port INTEGER NULL
    );
    """

    alter_deployments_add_server_id_sql = """
    ALTER TABLE deployments
    ADD COLUMN IF NOT EXISTS server_id UUID NULL;
    """

    alter_deployments_add_env_sql = """
    ALTER TABLE deployments
    ADD COLUMN IF NOT EXISTS env TEXT NOT NULL DEFAULT '{}';
    """

    create_notifications_table_sql = """
    CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY,
        deployment_id UUID NOT NULL,
        level VARCHAR(32) NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
    );
    """

    drop_notifications_fk_sql = """
    ALTER TABLE notifications
    DROP CONSTRAINT IF EXISTS notifications_deployment_id_fkey;
    """

    create_deployment_activity_table_sql = """
    CREATE TABLE IF NOT EXISTS deployment_activity (
        id UUID PRIMARY KEY,
        deployment_id UUID NOT NULL,
        level VARCHAR(32) NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
    );
    """

    create_upgrade_requests_table_sql = """
    CREATE TABLE IF NOT EXISTS upgrade_requests (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL,
        company_or_team TEXT NULL,
        use_case TEXT NULL,
        current_plan TEXT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        internal_note TEXT NULL,
        handled_by_user_id UUID NULL,
        target_user_id UUID NULL,
        reviewed_at TIMESTAMPTZ NULL,
        updated_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL
    );
    """

    alter_upgrade_requests_add_status_sql = """
    ALTER TABLE upgrade_requests
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new';
    """

    alter_upgrade_requests_add_internal_note_sql = """
    ALTER TABLE upgrade_requests
    ADD COLUMN IF NOT EXISTS internal_note TEXT NULL;
    """

    alter_upgrade_requests_add_handled_by_user_id_sql = """
    ALTER TABLE upgrade_requests
    ADD COLUMN IF NOT EXISTS handled_by_user_id UUID NULL;
    """

    alter_upgrade_requests_add_target_user_id_sql = """
    ALTER TABLE upgrade_requests
    ADD COLUMN IF NOT EXISTS target_user_id UUID NULL;
    """

    alter_upgrade_requests_add_reviewed_at_sql = """
    ALTER TABLE upgrade_requests
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ NULL;
    """

    alter_upgrade_requests_add_updated_at_sql = """
    ALTER TABLE upgrade_requests
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NULL;
    """

    create_deployment_templates_table_sql = """
    CREATE TABLE IF NOT EXISTS deployment_templates (
        id UUID PRIMARY KEY,
        template_name TEXT NOT NULL,
        image TEXT NOT NULL,
        name TEXT NULL,
        internal_port INTEGER NULL,
        external_port INTEGER NULL,
        server_id UUID NULL,
        env TEXT NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        last_used_at TIMESTAMPTZ NULL,
        use_count INTEGER NOT NULL DEFAULT 0
    );
    """

    alter_templates_add_updated_at_sql = """
    ALTER TABLE deployment_templates
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    """

    alter_templates_add_last_used_at_sql = """
    ALTER TABLE deployment_templates
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ NULL;
    """

    alter_templates_add_use_count_sql = """
    ALTER TABLE deployment_templates
    ADD COLUMN IF NOT EXISTS use_count INTEGER NOT NULL DEFAULT 0;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(create_users_table_sql)
            cur.execute(alter_users_add_must_change_password_sql)
            cur.execute(alter_users_add_plan_sql)
            cur.execute(alter_users_add_role_sql)
            cur.execute(create_sessions_table_sql)
            cur.execute(create_servers_table_sql)
            cur.execute(create_deployments_table_sql)
            cur.execute(alter_deployments_add_server_id_sql)
            cur.execute(alter_deployments_add_env_sql)
            cur.execute(create_notifications_table_sql)
            cur.execute(drop_notifications_fk_sql)
            cur.execute(create_deployment_activity_table_sql)
            cur.execute(create_upgrade_requests_table_sql)
            cur.execute(alter_upgrade_requests_add_status_sql)
            cur.execute(alter_upgrade_requests_add_internal_note_sql)
            cur.execute(alter_upgrade_requests_add_handled_by_user_id_sql)
            cur.execute(alter_upgrade_requests_add_target_user_id_sql)
            cur.execute(alter_upgrade_requests_add_reviewed_at_sql)
            cur.execute(alter_upgrade_requests_add_updated_at_sql)
            cur.execute(create_deployment_templates_table_sql)
            cur.execute(alter_templates_add_updated_at_sql)
            cur.execute(alter_templates_add_last_used_at_sql)
            cur.execute(alter_templates_add_use_count_sql)
        conn.commit()

    ensure_default_user()


def _serialize_value(value: Any) -> Any:
    if isinstance(value, (datetime, uuid.UUID)):
        return str(value)
    return value


def _row_to_dict(cursor: psycopg.Cursor[Any], row: tuple[Any, ...]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for description, value in zip(cursor.description, row):
        serialized_value = _serialize_value(value)
        if description.name == "env" and isinstance(serialized_value, str):
            try:
                result[description.name] = json.loads(serialized_value)
            except json.JSONDecodeError:
                result[description.name] = {}
            continue
        result[description.name] = serialized_value
    return result


def insert_deployment_record(deployment_record: dict[str, Any]) -> None:
    insert_sql = """
    INSERT INTO deployments (
        id,
        status,
        image,
        container_name,
        container_id,
        created_at,
        error,
        internal_port,
        external_port,
        server_id,
        env
    )
    VALUES (%(id)s, %(status)s, %(image)s, %(container_name)s, %(container_id)s,
            %(created_at)s, %(error)s, %(internal_port)s, %(external_port)s, %(server_id)s, %(env)s);
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(insert_sql, deployment_record)
        conn.commit()


def update_deployment_record(
    deployment_id: str,
    status: str,
    container_id: str | None,
    error: str | None,
) -> None:
    update_sql = """
    UPDATE deployments
    SET status = %s,
        container_id = %s,
        error = %s
    WHERE id = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(update_sql, (status, container_id, error, deployment_id))
        conn.commit()


def update_deployment_configuration(
    deployment_id: str,
    image: str,
    container_name: str,
    internal_port: int | None,
    external_port: int | None,
    env: dict[str, str],
) -> None:
    update_sql = """
    UPDATE deployments
    SET image = %s,
        container_name = %s,
        internal_port = %s,
        external_port = %s,
        env = %s
    WHERE id = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                update_sql,
                (
                    image,
                    container_name,
                    internal_port,
                    external_port,
                    json.dumps(env),
                    deployment_id,
                ),
            )
        conn.commit()


def get_deployment_record_or_404(deployment_id: str) -> dict[str, Any]:
    select_sql = """
    SELECT
        d.id,
        d.status,
        d.image,
        d.container_name,
        d.container_id,
        d.created_at,
        d.error,
        d.internal_port,
        d.external_port,
        d.server_id,
        d.env,
        s.name AS server_name,
        s.host AS server_host
    FROM deployments d
    LEFT JOIN servers s ON s.id = d.server_id
    WHERE d.id = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql, (deployment_id,))
            row = cur.fetchone()

            if row is None:
                raise HTTPException(status_code=404, detail="Deployment not found.")

            return _row_to_dict(cur, row)


def list_deployment_records() -> list[dict[str, Any]]:
    select_sql = """
    SELECT
        d.id,
        d.status,
        d.image,
        d.container_name,
        d.container_id,
        d.created_at,
        d.error,
        d.internal_port,
        d.external_port,
        d.server_id,
        d.env,
        s.name AS server_name,
        s.host AS server_host
    FROM deployments d
    LEFT JOIN servers s ON s.id = d.server_id
    ORDER BY d.created_at DESC;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql)
            rows = cur.fetchall()
            return [_row_to_dict(cur, row) for row in rows]


def delete_deployment_record(deployment_id: str) -> None:
    delete_sql = """
    DELETE FROM deployments
    WHERE id = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(delete_sql, (deployment_id,))
        conn.commit()


def insert_deployment_template(template_record: dict[str, Any]) -> None:
    insert_sql = """
    INSERT INTO deployment_templates (
        id,
        template_name,
        image,
        name,
        internal_port,
        external_port,
        server_id,
        env,
        created_at,
        updated_at,
        last_used_at,
        use_count
    )
    VALUES (
        %(id)s,
        %(template_name)s,
        %(image)s,
        %(name)s,
        %(internal_port)s,
        %(external_port)s,
        %(server_id)s,
        %(env)s,
        %(created_at)s,
        %(updated_at)s,
        %(last_used_at)s,
        %(use_count)s
    );
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(insert_sql, template_record)
        conn.commit()


def list_deployment_templates() -> list[dict[str, Any]]:
    select_sql = """
    SELECT
        t.id,
        t.template_name,
        t.image,
        t.name,
        t.internal_port,
        t.external_port,
        t.server_id,
        t.env,
        t.created_at,
        t.updated_at,
        t.last_used_at,
        t.use_count,
        s.name AS server_name,
        s.host AS server_host
    FROM deployment_templates t
    LEFT JOIN servers s ON s.id = t.server_id
    ORDER BY t.created_at DESC;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql)
            rows = cur.fetchall()
            return [_row_to_dict(cur, row) for row in rows]


def get_deployment_template_or_404(template_id: str) -> dict[str, Any]:
    select_sql = """
    SELECT
        t.id,
        t.template_name,
        t.image,
        t.name,
        t.internal_port,
        t.external_port,
        t.server_id,
        t.env,
        t.created_at,
        t.updated_at,
        t.last_used_at,
        t.use_count,
        s.name AS server_name,
        s.host AS server_host
    FROM deployment_templates t
    LEFT JOIN servers s ON s.id = t.server_id
    WHERE t.id = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql, (template_id,))
            row = cur.fetchone()

            if row is None:
                raise HTTPException(status_code=404, detail="Deployment template not found.")

            return _row_to_dict(cur, row)


def delete_deployment_template_record(template_id: str) -> None:
    delete_sql = """
    DELETE FROM deployment_templates
    WHERE id = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(delete_sql, (template_id,))
        conn.commit()


def update_deployment_template(template_id: str, template_record: dict[str, Any]) -> None:
    update_sql = """
    UPDATE deployment_templates
    SET template_name = %(template_name)s,
        image = %(image)s,
        name = %(name)s,
        internal_port = %(internal_port)s,
        external_port = %(external_port)s,
        server_id = %(server_id)s,
        env = %(env)s,
        updated_at = %(updated_at)s
    WHERE id = %(id)s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(update_sql, {"id": template_id, **template_record})
        conn.commit()


def mark_deployment_template_used(template_id: str) -> None:
    update_sql = """
    UPDATE deployment_templates
    SET last_used_at = %s,
        updated_at = %s,
        use_count = use_count + 1
    WHERE id = %s;
    """

    now = datetime.now(timezone.utc)
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(update_sql, (now, now, template_id))
        conn.commit()


def insert_server(server_record: dict[str, Any]) -> None:
    insert_sql = """
    INSERT INTO servers (
        id, name, host, port, username, auth_type, password, ssh_key, created_at
    )
    VALUES (
        %(id)s, %(name)s, %(host)s, %(port)s, %(username)s, %(auth_type)s,
        %(password)s, %(ssh_key)s, %(created_at)s
    );
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(insert_sql, server_record)
        conn.commit()


def list_servers() -> list[dict[str, Any]]:
    select_sql = """
    SELECT id, name, host, port, username, auth_type, password, ssh_key, created_at
    FROM servers
    ORDER BY created_at DESC;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql)
            rows = cur.fetchall()
            return [_row_to_dict(cur, row) for row in rows]


def get_server_or_404(server_id: str) -> dict[str, Any]:
    select_sql = """
    SELECT id, name, host, port, username, auth_type, password, ssh_key, created_at
    FROM servers
    WHERE id = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql, (server_id,))
            row = cur.fetchone()

            if row is None:
                raise HTTPException(status_code=404, detail="Server not found.")

            return _row_to_dict(cur, row)


def delete_server_record(server_id: str) -> None:
    delete_sql = """
    DELETE FROM servers
    WHERE id = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(delete_sql, (server_id,))
        conn.commit()


def count_deployments_for_server(server_id: str) -> int:
    select_sql = """
    SELECT COUNT(*)
    FROM deployments
    WHERE server_id = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql, (server_id,))
            row = cur.fetchone()
            return int(row[0]) if row else 0


def create_notification(
    deployment_id: str,
    level: str,
    title: str,
    message: str,
) -> None:
    notification_record = {
        "id": str(uuid.uuid4()),
        "deployment_id": deployment_id,
        "level": level,
        "title": title,
        "message": message,
        "created_at": datetime.now(timezone.utc),
    }

    insert_sql = """
    INSERT INTO notifications (id, deployment_id, level, title, message, created_at)
    VALUES (%(id)s, %(deployment_id)s, %(level)s, %(title)s, %(message)s, %(created_at)s);
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(insert_sql, notification_record)
        conn.commit()


def ensure_default_user() -> None:
    username = os.getenv("DEPLOYMATE_ADMIN_USERNAME", "admin")
    password = os.getenv("DEPLOYMATE_ADMIN_PASSWORD", "admin")
    existing_user = get_user_by_username(username)
    if existing_user:
        set_user_role(existing_user["id"], "admin")
        if username == "admin" and password == "admin" and _verify_password("admin", existing_user["password_hash"]):
            set_user_must_change_password(existing_user["id"], True)
        return

    user_record = {
        "id": str(uuid.uuid4()),
        "username": username,
        "password_hash": _hash_password(password),
        "plan": "trial",
        "role": "admin",
        "must_change_password": username == "admin" and password == "admin",
        "created_at": datetime.now(timezone.utc),
    }

    insert_sql = """
    INSERT INTO users (id, username, password_hash, plan, role, must_change_password, created_at)
    VALUES (%(id)s, %(username)s, %(password_hash)s, %(plan)s, %(role)s, %(must_change_password)s, %(created_at)s);
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(insert_sql, user_record)
        conn.commit()


def get_user_by_username(username: str) -> dict[str, Any] | None:
    select_sql = """
    SELECT id, username, password_hash, plan, role, must_change_password, created_at
    FROM users
    WHERE username = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql, (username,))
            row = cur.fetchone()
            return _row_to_dict(cur, row) if row else None


def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    select_sql = """
    SELECT id, username, password_hash, plan, role, must_change_password, created_at
    FROM users
    WHERE id = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql, (user_id,))
            row = cur.fetchone()
            return _row_to_dict(cur, row) if row else None


def update_user_password(user_id: str, new_password: str) -> None:
    update_sql = """
    UPDATE users
    SET password_hash = %s,
        must_change_password = FALSE
    WHERE id = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(update_sql, (_hash_password(new_password), user_id))
        conn.commit()


def set_user_must_change_password(user_id: str, value: bool) -> None:
    update_sql = """
    UPDATE users
    SET must_change_password = %s
    WHERE id = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(update_sql, (value, user_id))
        conn.commit()


def set_user_role(user_id: str, role: str) -> None:
    update_sql = """
    UPDATE users
    SET role = %s
    WHERE id = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(update_sql, (role, user_id))
        conn.commit()


def set_user_plan(user_id: str, plan: str) -> None:
    update_sql = """
    UPDATE users
    SET plan = %s
    WHERE id = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(update_sql, (plan, user_id))
        conn.commit()


def insert_user(user_record: dict[str, Any]) -> None:
    insert_sql = """
    INSERT INTO users (
        id,
        username,
        password_hash,
        plan,
        role,
        must_change_password,
        created_at
    )
    VALUES (
        %(id)s,
        %(username)s,
        %(password_hash)s,
        %(plan)s,
        %(role)s,
        %(must_change_password)s,
        %(created_at)s
    );
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(insert_sql, user_record)
        conn.commit()


def list_users() -> list[dict[str, Any]]:
    select_sql = """
    SELECT id, username, plan, role, must_change_password, created_at
    FROM users
    ORDER BY r.created_at DESC;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql)
            rows = cur.fetchall()
            return [_row_to_dict(cur, row) for row in rows]


def delete_user_record(user_id: str) -> None:
    delete_sql = """
    DELETE FROM users
    WHERE id = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(delete_sql, (user_id,))
        conn.commit()


def count_users_by_role(role: str) -> int:
    select_sql = """
    SELECT COUNT(*)
    FROM users
    WHERE role = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql, (role,))
            row = cur.fetchone()
            return int(row[0]) if row else 0


def create_session(token: str, user_id: str) -> None:
    session_record = {
        "token": token,
        "user_id": user_id,
        "created_at": datetime.now(timezone.utc),
    }

    insert_sql = """
    INSERT INTO sessions (token, user_id, created_at)
    VALUES (%(token)s, %(user_id)s, %(created_at)s);
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(insert_sql, session_record)
        conn.commit()


def get_session_user_by_token(token: str) -> dict[str, Any] | None:
    select_sql = """
    SELECT u.id, u.username, u.plan, u.role, u.must_change_password, u.created_at
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql, (token,))
            row = cur.fetchone()
            return _row_to_dict(cur, row) if row else None


def delete_session(token: str) -> None:
    delete_sql = """
    DELETE FROM sessions
    WHERE token = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(delete_sql, (token,))
        conn.commit()


def count_all_servers() -> int:
    select_sql = """
    SELECT COUNT(*)
    FROM servers;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql)
            row = cur.fetchone()
            return int(row[0]) if row else 0


def count_all_deployments() -> int:
    select_sql = """
    SELECT COUNT(*)
    FROM deployments;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql)
            row = cur.fetchone()
            return int(row[0]) if row else 0


def insert_upgrade_request(request_record: dict[str, Any]) -> None:
    insert_sql = """
    INSERT INTO upgrade_requests (
        id,
        name,
        email,
        company_or_team,
        use_case,
        current_plan,
        status,
        internal_note,
        handled_by_user_id,
        target_user_id,
        reviewed_at,
        updated_at,
        created_at
    )
    VALUES (
        %(id)s,
        %(name)s,
        %(email)s,
        %(company_or_team)s,
        %(use_case)s,
        %(current_plan)s,
        %(status)s,
        %(internal_note)s,
        %(handled_by_user_id)s,
        %(target_user_id)s,
        %(reviewed_at)s,
        %(updated_at)s,
        %(created_at)s
    );
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(insert_sql, request_record)
        conn.commit()


def list_upgrade_requests() -> list[dict[str, Any]]:
    select_sql = """
    SELECT
        r.id,
        r.name,
        r.email,
        r.company_or_team,
        r.use_case,
        r.current_plan,
        r.status,
        r.internal_note,
        r.handled_by_user_id,
        handler.username AS handled_by_username,
        r.target_user_id,
        target_user.username AS target_username,
        r.reviewed_at,
        r.updated_at,
        r.created_at
    FROM upgrade_requests r
    LEFT JOIN users handler ON handler.id = r.handled_by_user_id
    LEFT JOIN users target_user ON target_user.id = r.target_user_id
    ORDER BY created_at DESC;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql)
            rows = cur.fetchall()
            return [_row_to_dict(cur, row) for row in rows]


def get_upgrade_request_or_404(request_id: str) -> dict[str, Any]:
    select_sql = """
    SELECT
        r.id,
        r.name,
        r.email,
        r.company_or_team,
        r.use_case,
        r.current_plan,
        r.status,
        r.internal_note,
        r.handled_by_user_id,
        handler.username AS handled_by_username,
        r.target_user_id,
        target_user.username AS target_username,
        r.reviewed_at,
        r.updated_at,
        r.created_at
    FROM upgrade_requests r
    LEFT JOIN users handler ON handler.id = r.handled_by_user_id
    LEFT JOIN users target_user ON target_user.id = r.target_user_id
    WHERE r.id = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql, (request_id,))
            row = cur.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Upgrade request not found.")
            return _row_to_dict(cur, row)


def update_upgrade_request(
    request_id: str,
    *,
    status: str | None = None,
    internal_note: str | None = None,
    handled_by_user_id: str | None = None,
    target_user_id: str | None = None,
    reviewed_at: datetime | None = None,
    updated_at: datetime | None = None,
) -> None:
    update_sql = """
    UPDATE upgrade_requests
    SET status = COALESCE(%s, status),
        internal_note = %s,
        handled_by_user_id = COALESCE(%s, handled_by_user_id),
        target_user_id = %s,
        reviewed_at = %s,
        updated_at = %s
    WHERE id = %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                update_sql,
                (
                    status,
                    internal_note,
                    handled_by_user_id,
                    target_user_id,
                    reviewed_at,
                    updated_at,
                    request_id,
                ),
            )
        conn.commit()


def create_activity_event(
    deployment_id: str,
    level: str,
    title: str,
    message: str,
) -> None:
    activity_record = {
        "id": str(uuid.uuid4()),
        "deployment_id": deployment_id,
        "level": level,
        "title": title,
        "message": message,
        "created_at": datetime.now(timezone.utc),
    }

    insert_sql = """
    INSERT INTO deployment_activity (id, deployment_id, level, title, message, created_at)
    VALUES (%(id)s, %(deployment_id)s, %(level)s, %(title)s, %(message)s, %(created_at)s);
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(insert_sql, activity_record)
        conn.commit()


def list_notifications(limit: int = 20) -> list[dict[str, Any]]:
    select_sql = """
    SELECT id, deployment_id, level, title, message, created_at
    FROM notifications
    ORDER BY created_at DESC
    LIMIT %s;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql, (limit,))
            rows = cur.fetchall()
            return [_row_to_dict(cur, row) for row in rows]


def list_deployment_activity(deployment_id: str) -> list[dict[str, Any]]:
    select_sql = """
    SELECT id, deployment_id, level, title, message, created_at
    FROM deployment_activity
    WHERE deployment_id = %s
    ORDER BY created_at DESC;
    """

    with get_db_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(select_sql, (deployment_id,))
            rows = cur.fetchall()
            return [_row_to_dict(cur, row) for row in rows]
