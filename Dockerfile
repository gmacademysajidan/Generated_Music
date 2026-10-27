FROM python:3.11-slim

# Install system dependencies including FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Ensure Python output is unbuffered
ENV PYTHONUNBUFFERED=1
ENV PORT=7860

# Copy dependency definition
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Set permissions for downloads folder
RUN chmod -R 777 /app/downloads

# Hugging Face Spaces default port is 7860
EXPOSE 7860

# Run with gunicorn
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-7860} --workers 2 --timeout 180 app:app"]
