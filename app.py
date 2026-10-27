import os
import re
import sys
import time
import glob
import logging
from flask import Flask, render_template, request, jsonify, send_file, after_this_request
from flask_cors import CORS
import yt_dlp

app = Flask(__name__)
CORS(app)

# Base Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DOWNLOAD_DIR = os.path.join(BASE_DIR, "downloads")
BIN_DIR = os.path.join(BASE_DIR, "bin")
FFMPEG_PATH = os.path.join(BIN_DIR, "ffmpeg.exe")

os.makedirs(DOWNLOAD_DIR, exist_ok=True)
os.makedirs(BIN_DIR, exist_ok=True)

# Add BIN_DIR to PATH if local ffmpeg exists
if os.path.exists(FFMPEG_PATH):
    os.environ["PATH"] = BIN_DIR + os.pathsep + os.environ.get("PATH", "")
    FFMPEG_LOC = BIN_DIR
else:
    FFMPEG_LOC = None

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

def sanitize_filename(name: str) -> str:
    """Sanitize string for safe filename usage."""
    clean = re.sub(r'[\\/*?:"<>|]', '', name)
    clean = clean.strip()
    return clean[:120] if clean else "audio"

def cleanup_old_files(max_age_seconds: int = 1800):
    """Clean files older than max_age_seconds (default 30 mins) in download dir."""
    now = time.time()
    for f in glob.glob(os.path.join(DOWNLOAD_DIR, "*")):
        try:
            if os.path.isfile(f) and (now - os.path.getmtime(f)) > max_age_seconds:
                os.remove(f)
        except Exception as e:
            logging.warning(f"Error removing old file {f}: {e}")

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/info", methods=["POST"])
def get_video_info():
    """Extract metadata and stream options for a given YouTube URL."""
    data = request.get_json(silent=True) or {}
    url = data.get("url", "").strip()

    if not url:
        return jsonify({"success": False, "error": "URL YouTube tidak boleh kosong!"}), 400

    # Basic URL pattern check
    if not re.search(r'(youtube\.com|youtu\.be)', url, re.IGNORECASE):
        return jsonify({"success": False, "error": "Mohon masukkan tautan YouTube yang valid!"}), 400

    ydl_opts = {
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
    }
    if FFMPEG_LOC:
        ydl_opts["ffmpeg_location"] = FFMPEG_LOC

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Handle playlist or single entry
            if "entries" in info and info["entries"]:
                info = info["entries"][0]

            duration = info.get("duration", 0)
            # Check duration limit (optional warning if over 3 hours)
            max_duration = int(os.environ.get("MAX_DURATION_SECONDS", 14400))
            if duration and duration > max_duration:
                hours = max_duration // 3600
                return jsonify({
                    "success": False, 
                    "error": f"Durasi video terlalu panjang (> {hours} jam). Silakan pilih video yang lebih pendek."
                }), 400

            response_data = {
                "id": info.get("id"),
                "title": info.get("title", "Unknown Title"),
                "channel": info.get("uploader") or info.get("channel", "Unknown Channel"),
                "duration": duration,
                "thumbnail": info.get("thumbnail"),
                "views": info.get("view_count", 0),
                "webpage_url": info.get("webpage_url", url),
            }

            return jsonify({"success": True, "data": response_data})

    except yt_dlp.utils.DownloadError as e:
        error_msg = str(e)
        if "Private video" in error_msg:
            msg = "Video ini berstatus Private (pribadi) dan tidak dapat diakses."
        elif "Video unavailable" in error_msg:
            msg = "Video tidak tersedia atau telah dihapus oleh pemiliknya."
        else:
            msg = "Gagal membaca video YouTube. Pastikan link aktif dan publik."
        return jsonify({"success": False, "error": msg}), 400
    except Exception as e:
        logging.error(f"Error fetching info: {e}")
        return jsonify({"success": False, "error": f"Terjadi kesalahan: {str(e)}"}), 500

@app.route("/api/download", methods=["POST"])
def download_audio():
    """Download audio from YouTube and convert to MP3 at selected bitrate."""
    cleanup_old_files()

    data = request.get_json(silent=True) or {}
    url = data.get("url", "").strip()
    quality = str(data.get("quality", "320")).strip()

    valid_qualities = ["128", "192", "256", "320"]
    if quality not in valid_qualities:
        quality = "320"

    if not url:
        return jsonify({"error": "URL YouTube tidak boleh kosong!"}), 400

    timestamp = int(time.time() * 1000)
    output_template = os.path.join(DOWNLOAD_DIR, f"yt_audio_{timestamp}_%(id)s.%(ext)s")

    ydl_opts = {
        "format": "bestaudio/best",
        "outtmpl": output_template,
        "quiet": True,
        "no_warnings": True,
        "postprocessors": [
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": "mp3",
                "preferredquality": quality,
            },
            {
                "key": "FFmpegMetadata",
                "add_metadata": True,
            }
        ],
    }
    if FFMPEG_LOC:
        ydl_opts["ffmpeg_location"] = FFMPEG_LOC

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)
            if "entries" in info and info["entries"]:
                info = info["entries"][0]
            
            raw_title = info.get("title", "youtube_music")
            video_id = info.get("id", str(timestamp))
            clean_title = sanitize_filename(raw_title)

        # Expected output filename
        expected_file = os.path.join(DOWNLOAD_DIR, f"yt_audio_{timestamp}_{video_id}.mp3")

        # Fallback check if exact filename matches pattern
        if not os.path.exists(expected_file):
            matching = glob.glob(os.path.join(DOWNLOAD_DIR, f"yt_audio_{timestamp}_*.mp3"))
            if matching:
                expected_file = matching[0]
            else:
                return jsonify({"error": "Gagal menemukan file hasil konversi MP3."}), 500

        download_filename = f"{clean_title} [{quality}kbps].mp3"

        # Cleanup file after response is sent
        @after_this_request
        def remove_file(response):
            try:
                # We can keep or remove, let's keep for 10 minutes or remove after small delay
                pass
            except Exception as e:
                logging.error(f"Error in after_this_request: {e}")
            return response

        return send_file(
            expected_file,
            mimetype="audio/mpeg",
            as_attachment=True,
            download_name=download_filename
        )

    except yt_dlp.utils.DownloadError as e:
        logging.error(f"DownloadError: {e}")
        return jsonify({"error": "Gagal mengunduh audio dari YouTube. Silakan coba lagi."}), 400
    except Exception as e:
        logging.error(f"Unexpected download error: {e}")
        return jsonify({"error": f"Terjadi kesalahan saat konversi MP3: {str(e)}"}), 500

if __name__ == "__main__":
    try:
        if sys.stdout.encoding.lower() != 'utf-8':
            sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass
    port = int(os.environ.get("PORT", 5000))
    print("=" * 60)
    print(" [*] YouTube to MP3 Music Downloader is RUNNING!")
    print(f" [*] Buka di browser: http://localhost:{port}")
    print("=" * 60)
    app.run(host="0.0.0.0", port=port, debug=False)
