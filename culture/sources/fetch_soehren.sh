#!/bin/bash
# Fetch Lloyd J. Soehren's Catalog of Hawaiʻi Place Names (UH Mānoa Library) for the four islands.
# Twelve requests in all. robots.txt asks for a 3 second crawl delay; this waits 5.
#   bash culture/sources/fetch_soehren.sh <cache-dir>
set -e
OUT=${1:-$HOME/.cache/oceansafe-culture-sources}; mkdir -p "$OUT"; cd "$OUT"
UA="Mozilla/5.0 (OceanSafe educational research; contact mossmankauai@gmail.com)"
B="https://manoa.hawaii.edu/hawaiiancollection/soehren/multiprocess.php"
OK=%CA%BB
get(){ sleep 5; curl -sL -A "$UA" --max-time 300 -o "$1" -w "$1 %{http_code} %{size_download}\n" "$2"; }
for I in "Kaua${OK}i:kauai" "O${OK}ahu:oahu" "Maui:maui" "Hawai${OK}i:hawaii"; do
  T=${I%%:*}; K=${I##*:}
  get "ahu_$K.html" "$B?boolean1=1&terms1=ahupua${OK}a&fields1=4&booleanb1=1&boolean2=1&terms2=$T&fields2=3"
  get "all_$K.html" "$B?boolean1=1&terms1=$T&fields1=3"
done
