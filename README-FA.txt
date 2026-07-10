بسته به‌روزرسانی سامان حساب — نسخه 0.8.0

این بسته فقط روی نسخه 0.7 اعمال می‌شود و فایل‌های قبلی/بکاپ را دست نمی‌زند.

چهار تغییر نسخه 0.8:
1) ورود، ساخت/تشخیص store_id، بازیابی رمز و تنظیم رمز جدید پایدارتر شده است.
2) فرمان صوتی با کلمه بیدارباش «حسابدار» و تشخیص چند شکل مختلف جمله فارسی؛ متن کامل فرمان همراه تاریخ و ساعت در شرح ذخیره می‌شود.
3) هنگام تایپ نام مشتری در ثبت بدهی/پرداخت، فهرست مشتری‌های همان فروشگاه پیشنهاد داده می‌شود.
4) صفحه درباره برنامه تکمیل شده و نام توسعه‌دهنده سامان رفیعی، شماره تماس و نسخه 0.8.0 نمایش داده می‌شود.

بهبودهای همراه:
- هر فروشگاه فقط مشتری‌ها و تراکنش‌های خودش را می‌بیند.
- کلیک روی مشتری، جزئیات حساب را باز می‌کند.
- ویرایش/حذف تراکنش و ویرایش/حذف مشتری فعال است.
- Build واقعی با npm run build آزمایش و موفق شده است.

روش اعمال در Termux:

cd ~/saman-hesab
mkdir -p backups/v07-before-v08
cp src/components/AuthGate.tsx backups/v07-before-v08/
cp src/components/LegacyApp.tsx backups/v07-before-v08/
cp src/App.css backups/v07-before-v08/
unzip -o /sdcard/Download/saman-hesab-v08-update.zip -d ~/saman-hesab
npm run build

برای ذخیره روی GitHub:
git add src/components/AuthGate.tsx src/components/LegacyApp.tsx src/App.css
git commit -m "Release v0.8.0"
git push

برای انتشار سایت:
npx gh-pages -d dist -b gh-pages
