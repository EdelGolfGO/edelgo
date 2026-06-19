#!/bin/bash
# Lightens the EdelFit dark color palette across all .tsx files in src/
# Run from the root of your edelgo project: bash lighten-palette.sh

set -e

echo "Backing up src/ to src_backup_$(date +%Y%m%d_%H%M%S)..."
cp -r src "src_backup_$(date +%Y%m%d_%H%M%S)"

echo "Applying lighter palette..."

# macOS sed requires '' after -i, Linux sed does not.
# This detects which one you're on automatically.
if [[ "$OSTYPE" == "darwin"* ]]; then
  SED_INPLACE=(-i '')
else
  SED_INPLACE=(-i)
fi

# Backgrounds (darkest to lightest, preserving layering)
find src -name "*.tsx" -exec sed "${SED_INPLACE[@]}" \
  -e 's/#13161A/#23282E/g' \
  -e 's/#161A1D/#20242A/g' \
  -e 's/#1A1E22/#262B32/g' \
  -e 's/#1E2226/#2B3038/g' \
  -e 's/#22262B/#2E343C/g' \
  -e 's/#111316/#1A1D21/g' \
  {} +

# Text colors (gray scale lightened)
find src -name "*.tsx" -exec sed "${SED_INPLACE[@]}" \
  -e 's/#888/#B5BAC2/g' \
  -e 's/#666/#9BA0A8/g' \
  -e 's/#555/#8B919A/g' \
  -e 's/#444/#787E87/g' \
  -e 's/#333/#666C75/g' \
  -e 's/#2A2A2A/#3A3F47/g' \
  -e 's/#CCC/#E0E2E6/g' \
  {} +

echo "Done. A backup of the original src/ folder was created before changes were applied."
echo "Review the changes with: git diff"
echo "If anything looks wrong, restore from the backup folder or use: git checkout -- src/"
