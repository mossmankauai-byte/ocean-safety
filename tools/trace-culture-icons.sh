#!/usr/bin/env bash
# Rebuild window.CULTURE_ART from the artwork sheet. The sheet's background is TRANSPARENT, so the alpha
# channel is the mask: threshold it, dilate to merge each glyph's own parts without merging its neighbours,
# take one bounding box per blob, and trace each crop with potrace. A fixed grid does not work; it clips the
# tall glyphs and catches fragments of the next one.
#   brew install potrace && bash tools/trace-culture-icons.sh <sheet.png> <outdir>
set -eu
SHEET="${1:-culture/icon-sheet-source.png}"; OUT="${2:-/tmp/culture-icons}"
mkdir -p "$OUT"; cd "$OUT"
magick "$OLDPWD/$SHEET" -alpha extract -threshold 40% alpha.png
magick alpha.png -morphology Dilate Disk:14 blobs.png
magick blobs.png -define connected-components:verbose=true -define connected-components:area-threshold=1500 \
  -connected-components 8 null: 2>/dev/null | grep "gray(255)" | awk '{print $2}' > boxes.txt
echo "glyphs found: $(wc -l < boxes.txt)"
# Reading order and the crops are done by the python block in the session notes; potrace call per crop:
#   potrace -s -o a-NN.svg --turdsize 3 --alphamax 1.0 --opttolerance 0.4 a-NN.pbm
