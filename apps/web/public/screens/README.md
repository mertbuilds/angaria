# Screens

Marketing screenshots of the Angaria desktop app for angaria.app. The frontend ran in a browser at a 1440×900 viewport, device scale 2, with the dev GİB fixtures, the TCMB rates of the GİB emulator and Suisse Intl. Every name, address, VKN/TCKN, IBAN and invoice is made up: Deniz Yılmaz Yazılım (a şahıs şirketi in Kadıköy) and its customers Northwind Labs Inc. (USD), Hafenblick Studio GmbH (EUR), Kestrel Analytics Ltd (GBP), Atlas Dijital Teknoloji A.Ş. and Mavi Kare Reklam Ltd. Şti. (TRY, Satış).

## Files

WebP only (quality 82). PNG fallbacks would have taken the folder to 12 MB; these come to 5.7 MB.

Each app screen comes in eight files, `<screen>-<theme>[-framed]-<width>.webp`:

- `light`, `dark`: the app's light and dark theme.
- `2880` (2880×1800, retina) and `1440` (1440×900).
- `-framed`: the same image as a macOS window: 12px corners (24px at 2880) on a transparent background, a 1px border and the three traffic lights in the site's gray (`#d4d4d4` light, `#3f3f3f` dark, as in `window-frame.tsx`). Without it: the window content edge to edge, as the app renders it.

| Screen             | What it shows                                                                                                                                                                                                                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `faturalar-detail` | Faturalar, Son 3 ay: eleven invoices with totals and Onaylandı / Onaylanmadı badges. The signed Northwind Labs invoice GIB2026000000023 ($7.640,00) is open: GİB's e-Arşiv preview with the QR code, PDF indir (Türkçe ve İngilizce), Tekrar kes.                                                           |
| `yeni-fatura`      | Yeni fatura from Tekrar kes on GIB2026000000023: İstisna, USD at TCMB's buying rate (45,1961, 1 Ekim 2026), Son ödeme tarihi, two lines (Yazılım geliştirme hizmeti 1 × 6.500, Danışmanlık 12 saat × 95) and the Özet card with the lira total, the TR+EN PDF switch, Taslak oluştur and Oluştur ve onayla. |
| `yeni-start`       | Yeni fatura's start screen, "Geçen faturadan başlayın": the five newest invoices with Tekrar kes, and Boş fatura.                                                                                                                                                                                           |
| `musteriler`       | Müşteriler: five customers, Northwind Labs Inc. selected and scrolled to its Fatura varsayılanları (USD, İstisna, KDV 0, PDF Türkçe ve İngilizce, payment due 14 days after the invoice).                                                                                                                   |
| `palette`          | The ⌘K command palette over Faturalar: Yeni fatura, Geçen ayın faturasını tekrar kes, and the sections with their shortcuts.                                                                                                                                                                                |
| `sms`              | The SMS ile onayla dialog over the unsigned Atlas Dijital draft, the code half typed.                                                                                                                                                                                                                       |
| `license`          | The license screen, "Angaria'yı etkinleştirin", with a key typed in.                                                                                                                                                                                                                                        |

The PDF is paper, so it has one version and no frame:

| File            | What it shows                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pdf-2880.webp` | Page 1 of the PDF of GIB2026000000023 as the app downloads it: minimal style, Turkish and English side by side, QR code, bank details. 2880×4074. |
| `pdf-1440.webp` | The same at 1440×2037.                                                                                                                            |

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
