# Builder stage — install Python dependencies
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Runtime stage
FROM python:3.12-slim
WORKDIR /app
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH
COPY . .
RUN mkdir -p /app/audio_output
EXPOSE 8000
CMD ["uvicorn", "voicehire.api.server:app", "--host", "0.0.0.0", "--port", "8000"]
