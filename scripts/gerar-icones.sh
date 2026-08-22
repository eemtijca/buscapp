#!/usr/bin/env bash
# Gera os ícones do PWA a partir do glifo "mortarboard" do bootstrap-icons,
# na cor primária do app (--bs-primary: #008241). Requer ImageMagick.
set -euo pipefail

raiz="$(cd "$(dirname "$0")/.." && pwd)"
glifo="$raiz/node_modules/bootstrap-icons/icons/mortarboard.svg"
saida="$raiz/public"

verde="#008241"
branco="#ffffff"

mkdir -p "$saida/icons"

# favicon.svg: glifo verde sobre fundo transparente (viewBox 16x16 em canvas 512)
sed -e 's/fill="currentColor"/fill="'"$verde"'"/' \
    -e 's/ class="[^"]*"//' \
    -e 's/width="16" height="16"/width="512" height="512"/' \
    "$glifo" > "$saida/favicon.svg"

# Ícones "any": glifo em ~62% sobre fundo branco 512x512
magick -size 512x512 "xc:$branco" \
  \( "$saida/favicon.svg" -resize 318x318 \) \
  -gravity center -composite "$saida/icons/icon-512.png"
magick "$saida/icons/icon-512.png" -resize 192x192 "$saida/icons/icon-192.png"

# apple-touch-icon.png 180x180 (o iOS aplica os cantos arredondados)
magick -size 180x180 "xc:$branco" \
  \( "$saida/favicon.svg" -resize 112x112 \) \
  -gravity center -composite "$saida/apple-touch-icon.png"

# Maskable: glifo reduzido para caber na zona segura (círculo de 80% do diâmetro)
magick -size 512x512 "xc:$branco" \
  \( "$saida/favicon.svg" -resize 287x287 \) \
  -gravity center -composite "$saida/icons/maskable-icon-512.png"
magick "$saida/icons/maskable-icon-512.png" -resize 192x192 "$saida/icons/maskable-icon-192.png"

# favicon.ico multi-tamanho com fundo transparente
magick -background none "$saida/favicon.svg" \
  -define icon:auto-resize=16,32,48 "$saida/favicon.ico"

identify "$saida/favicon.ico" "$saida/favicon.svg" \
  "$saida/apple-touch-icon.png" "$saida/icons/"*.png
