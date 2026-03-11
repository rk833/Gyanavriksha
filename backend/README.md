## Backend setup (with `uv` and Alembic)

### 1. Install `uv` (once per machine)

```bash
pip install uv
```

### 2. Change into backend folder

```bash
cd backend
```

### 3. Create and activate a virtual environment

#### 3.1 Create venv with `uv`

```bash
uv venv .venv
```

#### 3.2 Activate venv (choose your shell/OS)

- **Windows – PowerShell**

  ```powershell
  .venv\Scripts\Activate.ps1
  ```

- **Windows – Command Prompt (cmd.exe)**

  ```cmd
  .venv\Scripts\activate.bat
  ```

- **Windows – Git Bash / WSL / Linux shells on Windows**

  ```bash
  source .venv/Scripts/activate
  # or, if running under WSL/Linux:
  # source .venv/bin/activate
  ```

- **Linux / macOS (Bash, Zsh, etc.)**

  ```bash
  source .venv/bin/activate
  ```

You should now see `(.venv)` or similar in your prompt.

### 4. Install dependencies with `uv sync`

```bash
uv sync
```

This reads `pyproject.toml` / `requirements.txt` and installs everything into `.venv`.

### 5. Run Alembic migrations

Make sure Postgres is running and your `.env` is configured for the DB, then:

```bash
uv run alembic upgrade head
```

This will apply all migrations and bring the database schema up to date.

### 6. (Optional) Create new migrations

After changing or adding models:

```bash
uv run alembic revision --autogenerate -m "describe your change"
uv run alembic upgrade head
```

---

## Alternative setup (without `uv`)

If you prefer plain `pip` + `venv`:

### 1. Create and activate virtual environment

```bash
cd backend
python -m venv .venv
```

- **Windows – PowerShell**

  ```powershell
  .venv\Scripts\Activate.ps1
  ```

- **Windows – Command Prompt**

  ```cmd
  .venv\Scripts\activate.bat
  ```

- **Linux / macOS / Git Bash / WSL**

  ```bash
  source .venv/bin/activate
  ```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Run Alembic migrations

```bash
alembic upgrade head
```

### 4. (Optional) Create new migrations

```bash
alembic revision --autogenerate -m "describe your change"
alembic upgrade head
```

