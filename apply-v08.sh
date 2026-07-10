#!/data/data/com.termux/files/usr/bin/bash
set -e
PROJECT="$HOME/saman-hesab"
ZIP="/sdcard/Download/saman-hesab-v08-update.zip"
cd "$PROJECT"
mkdir -p backups/v07-before-v08
cp src/components/AuthGate.tsx backups/v07-before-v08/AuthGate.tsx
cp src/components/LegacyApp.tsx backups/v07-before-v08/LegacyApp.tsx
cp src/App.css backups/v07-before-v08/App.css
unzip -o "$ZIP" -d "$PROJECT"
npm run build
echo "نسخه 0.8 با موفقیت اعمال و Build شد."
