FROM python:3.12-slim
WORKDIR /code
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
# make the `app` package importable for alembic / scripts, and run migrations +
# admin seed before serving (see scripts/start.sh)
ENV PYTHONPATH=/code
CMD ["sh", "scripts/start.sh"]
