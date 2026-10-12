# Screens

Marketing screenshots of the Angaria desktop app for angaria.app, captured 2026-10-13. The dev frontend (`pnpm --filter desktop dev`) ran in a browser at a 1440×900 viewport, device scale 2 (captured through CDP `Page.captureScreenshot`), in the default palette (mist, Serin), against the GİB emulator (Ayarlar › Gelişmiş › Emülatör, user 12345678) with its seed invoices and TCMB rates, and Suisse Intl. The sidebar icon was swapped for the release (blue) icon before each capture. Every name and number is demo data: the seller is Mert Düzgün (emulator user 12345678), the customers are Agent Caffeine (USD), knobs.dev (EUR), attention awareness (GBP), Vinena Studio (TRY, Satış) and Ahmet Buğra Yiğiter (TRY, a person).

A plain browser cannot keep the GİB session in the vault or force-close one (no cross-origin cookies), so do not reload during a capture: change the theme in Ayarlar › Görünüm and navigate inside the app. If GİB refuses a login for an open session, restart the emulator (touch a file in `packages/gib-emulator/src`).

## Files

WebP only (quality 82). PNG fallbacks would have taken the folder past 12 MB; these come to 2.0 MB.

Each app screen comes in eight files, `<screen>-<theme>[-framed]-<width>.webp`:

- `light`, `dark`: the app's light and dark theme.
- `2880` (2880×1800, retina) and `1440` (1440×900).
- `-framed`: the same image as a macOS window: 20px corners (40px at 2880), concentric with the app's content panel (12px corners, 8px in from the window), on a transparent background, a 1px border and the three traffic lights in the site's gray (`#d4d4d4` light, `#3f3f3f` dark, as in `components/screenshot.tsx`). Without it: the window content edge to edge, as the app renders it.

| Screen             | What it shows                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `faturalar-detail` | Faturalar, Son 3 ay: eleven documents with totals and Taslak / Onaylı / İptal edildi / Silindi badges. The signed Agent Caffeine invoice GIB2026000000005 ($7.640,00) is open: GİB's e-Arşiv preview with the QR code, Angaria PDF (İngilizce), Tekrar kes.                                                                                                                                                                                                                                                  |
| `yeni-fatura`      | Yeni fatura from Tekrar kes on GIB2026000000005, scrolled to Fatura: the Tarih and Son ödeme tarihi date fields, İstisna with 302 · Hizmet ihracatı and its KDV Kanunu 11/1-a link, USD at TCMB's buying rate (45,1383, the 12 Ekim 2026 bulletin, linked to TCMB's rates page), and the service under Hizmetler (Yazılım Geliştirme Hizmeti, 1 × 7.640,00 $) with its Birim and KDV choices. The Özet card shows Genel toplam, TL karşılığı, the PDF language switch, Taslak oluştur and Oluştur ve onayla. |

The GİB portal has no dark theme, so it has one version and no frame. It is the other side of the landing's compare slider, against `yeni-fatura`:

| File                   | What it shows                                                                                                                                                                                                                                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `gib-portal-2880.webp` | GİB's e-Arşiv portal on e-Arşiv Fatura (İnteraktif) Oluştur: the empty Fatura Bilgileri and Alıcı Bilgileri form. Mert's screenshot of the live portal, cut to 16:10 on the right (only the logout icon goes) and scaled from 2682×1676. The two header badges with the account holder's name and number are painted over in their own teal. 2880×1800. |
| `gib-portal-1440.webp` | The same at 1440×900.                                                                                                                                                                                                                                                                                                                                   |

## Use

Pick the theme with `prefers-color-scheme` and the width with `srcset`:

```html
<picture>
  <source
    media="(prefers-color-scheme: dark)"
    srcset="
      /screens/faturalar-detail-dark-framed-1440.webp 1440w,
      /screens/faturalar-detail-dark-framed-2880.webp 2880w
    "
  />
  <img
    alt="Angaria'da Faturalar ekranı: fatura listesi ve GİB önizlemesi"
    height="900"
    sizes="(min-width: 1200px) 1100px, 100vw"
    src="/screens/faturalar-detail-light-framed-1440.webp"
    srcset="
      /screens/faturalar-detail-light-framed-1440.webp 1440w,
      /screens/faturalar-detail-light-framed-2880.webp 2880w
    "
    width="1440"
  />
</picture>
```
