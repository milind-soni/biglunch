FROM python:3.12-slim
WORKDIR /app

RUN pip install uv

COPY pipelines/ .
RUN uv sync

EXPOSE 8080

CMD ["uv", "run", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]
