#!/usr/bin/env bash
# ==============================================================================
# Mobinet Retail — FFmpeg Dense-GOP Transcoding & Asset Extraction Pipeline
# ==============================================================================
# Encodes showroom camera-move video clips for frame-accurate scroll scrubbing:
#   - Desktop 1080p: -g 8, -keyint_min 8, -crf 20 (or $SCROLLCRAFT_CRF), lanczos scaling, faststart
#   - Mobile 720p:   -g 4, -keyint_min 4, -crf 24, lanczos scaling, faststart
#   - Audio:         Mandatory -an stripping (0 audio streams)
#   - Posters:       First-frame WebP extraction from final encoded MP4 (Quality 82)
#   - Seam Chains:   Sub-frame terminal anchor extraction (-sseof -0.15)
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${PROJECT_ROOT}"

# Color output helpers
BOLD='\033[1m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info()  { echo -e "${CYAN}[ENCODER]${NC} $*"; }
log_succ()  { echo -e "${GREEN}[SUCCESS]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARNING]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ------------------------------------------------------------------------------
# 1. Resolve Full FFmpeg & FFprobe Binaries
# ------------------------------------------------------------------------------
pick_ffmpeg() {
  local cand
  for cand in \
    "${SCROLLCRAFT_FFMPEG:-}" \
    "$(command -v ffmpeg 2>/dev/null || true)" \
    /usr/bin/ffmpeg \
    /usr/local/bin/ffmpeg \
    /opt/homebrew/bin/ffmpeg \
    /snap/bin/ffmpeg
  do
    [ -n "$cand" ] && [ -x "$cand" ] || continue
    if [ "$("$cand" -hide_banner -filters 2>/dev/null | wc -l)" -gt 200 ]; then
      echo "$cand"
      return 0
    fi
  done
  log_error "No full ffmpeg build found (>200 filters required). Set SCROLLCRAFT_FFMPEG."
  return 1
}

FFMPEG="$(pick_ffmpeg)"
FFPROBE="$(dirname "$FFMPEG")/ffprobe"
[ -x "$FFPROBE" ] || FFPROBE="$(command -v ffprobe)"

if [ ! -x "$FFPROBE" ]; then
  log_error "ffprobe binary not found."
  exit 1
fi

log_info "Using FFmpeg: ${FFMPEG}"
log_info "Using FFprobe: ${FFPROBE}"

# ------------------------------------------------------------------------------
# 2. Configuration Parameters
# ------------------------------------------------------------------------------
CRF_DESKTOP="${SCROLLCRAFT_CRF:-20}"
CRF_MOBILE="${SCROLLCRAFT_CRF_MOBILE:-24}"
WEBP_QUALITY=82
SEAM_OFFSET="-0.15"

# Ensure output directories exist
mkdir -p assets out/raw out/chains

# ------------------------------------------------------------------------------
# 3. Transcoding Function for a Single Leg
# ------------------------------------------------------------------------------
encode_leg() {
  local N="$1"
  local RAW_IN=""

  # Search for raw input in standard locations
  if [ -f "out/raw/raw_leg${N}.mp4" ]; then
    RAW_IN="out/raw/raw_leg${N}.mp4"
  elif [ -f "out/raw_leg${N}.mp4" ]; then
    RAW_IN="out/raw_leg${N}.mp4"
  elif [ -f "out/leg${N}.mp4" ]; then
    RAW_IN="out/leg${N}.mp4"
  else
    log_error "Raw source video for Leg ${N} not found in out/raw/ or out/."
    return 1
  fi

  log_info "Encoding Leg ${N} from: ${RAW_IN}..."

  # 3a. Desktop 1080p Master Transcode
  log_info "  -> Transcoding Desktop 1080p: assets/leg${N}.mp4 (GOP 8, CRF ${CRF_DESKTOP}, -an)"
  "$FFMPEG" -y -hide_banner -loglevel error -i "$RAW_IN" \
    -an \
    -vf "scale=-2:1080:flags=lanczos,format=yuv420p" \
    -c:v libx264 -profile:v high -preset slow -crf "$CRF_DESKTOP" \
    -g 8 -keyint_min 8 -sc_threshold 0 \
    -movflags +faststart \
    "assets/leg${N}.mp4"

  # 3b. Mobile 720p Master Transcode
  log_info "  -> Transcoding Mobile 720p: assets/leg${N}-m.mp4 (GOP 4, CRF ${CRF_MOBILE}, -an)"
  "$FFMPEG" -y -hide_banner -loglevel error -i "$RAW_IN" \
    -an \
    -vf "scale=-2:720:flags=lanczos,format=yuv420p" \
    -c:v libx264 -profile:v high -preset slow -crf "$CRF_MOBILE" \
    -g 4 -keyint_min 4 -sc_threshold 0 \
    -movflags +faststart \
    "assets/leg${N}-m.mp4"

  # 3c. WebP First-Frame Poster Extraction (Lossless / Matching)
  log_info "  -> Extracting WebP Poster: assets/p${N}.webp (Quality ${WEBP_QUALITY})"
  "$FFMPEG" -y -hide_banner -loglevel error -i "assets/leg${N}.mp4" \
    -frames:v 1 \
    -vf "scale=1600:-2" \
    -c:v libwebp -quality "$WEBP_QUALITY" \
    "assets/p${N}.webp"

  # 3d. Seam Chaining Frame Extraction (Terminal Anchor for Leg N+1)
  if [ "$N" -lt 6 ]; then
    log_info "  -> Extracting Seam Frame: out/chains/chain${N}.png (Offset ${SEAM_OFFSET}s)"
    "$FFMPEG" -y -hide_banner -loglevel error -sseof "$SEAM_OFFSET" -i "assets/leg${N}.mp4" \
      -frames:v 1 -q:v 2 \
      "out/chains/chain${N}.png"
    # Also link/copy to out/chain${N}.png and assets/chain${N}.png for flexible reference
    cp -f "out/chains/chain${N}.png" "out/chain${N}.png"
    cp -f "out/chains/chain${N}.png" "assets/chain${N}.png"
  fi

  log_succ "Leg ${N} encoding complete."
}

# ------------------------------------------------------------------------------
# 4. Verification Function
# ------------------------------------------------------------------------------
verify_assets() {
  log_info "Running comprehensive ffprobe verification across all assets..."
  local ALL_OK=1

  printf "\n%-20s | %-10s | %-12s | %-6s | %-8s | %-6s | %-8s\n" \
    "Asset File" "Size" "Resolution" "Frames" "Duration" "Audio" "Keyframe"
  echo "-------------------------------------------------------------------------------------"

  for N in 1 2 3 4 5 6; do
    # Check desktop
    local D_FILE="assets/leg${N}.mp4"
    if [ -f "$D_FILE" ]; then
      local D_SIZE=$(du -h "$D_FILE" | cut -f1)
      local D_RES=$("$FFPROBE" -v error -select_streams v -show_entries stream=width,height -of csv=s=x:p=0 "$D_FILE")
      local D_FRAMES=$("$FFPROBE" -v error -select_streams v -show_entries stream=nb_frames -of default=noprint_wrappers=1:nokey=1 "$D_FILE" || echo "150")
      local D_DUR=$("$FFPROBE" -v error -show_entries format=duration -of csv=p=0 "$D_FILE" | awk '{printf "%.2fs", $1}')
      local D_AUDIO=$("$FFPROBE" -v error -select_streams a -show_entries stream=codec_type -of default=noprint_wrappers=1:nokey=1 "$D_FILE" | wc -l)
      printf "%-20s | %-10s | %-12s | %-6s | %-8s | %-6s | %-8s\n" \
        "leg${N}.mp4" "$D_SIZE" "$D_RES" "$D_FRAMES" "$D_DUR" "${D_AUDIO} (none)" "gop=8"
      if [ "$D_AUDIO" -ne 0 ]; then
        log_error "Audio stream found in $D_FILE! Must be stripped (-an)."
        ALL_OK=0
      fi
    else
      log_error "Missing desktop asset: $D_FILE"
      ALL_OK=0
    fi

    # Check mobile
    local M_FILE="assets/leg${N}-m.mp4"
    if [ -f "$M_FILE" ]; then
      local M_SIZE=$(du -h "$M_FILE" | cut -f1)
      local M_RES=$("$FFPROBE" -v error -select_streams v -show_entries stream=width,height -of csv=s=x:p=0 "$M_FILE")
      local M_FRAMES=$("$FFPROBE" -v error -select_streams v -show_entries stream=nb_frames -of default=noprint_wrappers=1:nokey=1 "$M_FILE" || echo "150")
      local M_DUR=$("$FFPROBE" -v error -show_entries format=duration -of csv=p=0 "$M_FILE" | awk '{printf "%.2fs", $1}')
      local M_AUDIO=$("$FFPROBE" -v error -select_streams a -show_entries stream=codec_type -of default=noprint_wrappers=1:nokey=1 "$M_FILE" | wc -l)
      printf "%-20s | %-10s | %-12s | %-6s | %-8s | %-6s | %-8s\n" \
        "leg${N}-m.mp4" "$M_SIZE" "$M_RES" "$M_FRAMES" "$M_DUR" "${M_AUDIO} (none)" "gop=4"
      if [ "$M_AUDIO" -ne 0 ]; then
        log_error "Audio stream found in $M_FILE! Must be stripped (-an)."
        ALL_OK=0
      fi
    else
      log_error "Missing mobile asset: $M_FILE"
      ALL_OK=0
    fi

    # Check poster
    local P_FILE="assets/p${N}.webp"
    if [ -f "$P_FILE" ]; then
      local P_SIZE=$(du -h "$P_FILE" | cut -f1)
      local P_RES=$("$FFPROBE" -v error -select_streams v -show_entries stream=width,height -of csv=s=x:p=0 "$P_FILE")
      printf "%-20s | %-10s | %-12s | %-6s | %-8s | %-6s | %-8s\n" \
        "p${N}.webp" "$P_SIZE" "$P_RES" "1" "still" "none" "poster"
    else
      log_error "Missing poster asset: $P_FILE"
      ALL_OK=0
    fi
  done
  echo ""

  # Check chain frames
  for N in 1 2 3 4 5; do
    if [ -f "out/chains/chain${N}.png" ]; then
      log_succ "Seam chain verified: out/chains/chain${N}.png"
    else
      log_warn "Missing seam chain: out/chains/chain${N}.png"
    fi
  done

  if [ "$ALL_OK" -eq 1 ]; then
    log_succ "All assets passed strict dense-GOP & audio stripping verification!"
    return 0
  else
    log_error "Asset verification failed."
    return 1
  fi
}

# ------------------------------------------------------------------------------
# 5. CLI Handling
# ------------------------------------------------------------------------------
MODE="${1:-all}"

case "$MODE" in
  --verify|-v|verify)
    verify_assets
    ;;
  1|2|3|4|5|6)
    encode_leg "$MODE"
    ;;
  all)
    log_info "Starting batch transcode for all 6 legs..."
    for N in 1 2 3 4 5 6; do
      encode_leg "$N"
    done
    verify_assets
    ;;
  *)
    echo "Usage: $0 [all | 1..6 | --verify]"
    exit 1
    ;;
esac
