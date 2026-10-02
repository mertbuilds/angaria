# Screens

Marketing screenshots of the Angaria desktop app for angaria.app. The frontend ran in a browser at a 1440×900 viewport, device scale 2, in the default color palette (mist, Serin), with the dev GİB fixtures, the TCMB rates of the GİB emulator and Suisse Intl. The sidebar shows the app's sections: Faturalar, Yeni fatura, Müşteriler, Hizmetler, MCP and Ayarlar. Every name, address, VKN/TCKN, IBAN and invoice is made up: Deniz Yılmaz Yazılım (a şahıs şirketi in Kadıköy) and its customers Northwind Labs Inc. (USD), Hafenblick Studio GmbH (EUR), Kestrel Analytics Ltd (GBP), Atlas Dijital Teknoloji A.Ş. and Mavi Kare Reklam Ltd. Şti. (TRY, Satış).

## Files

WebP only (quality 82). PNG fallbacks would have taken the folder past 12 MB; these come to 5.1 MB.

Each app screen comes in eight files, `<screen>-<theme>[-framed]-<width>.webp`:

- `light`, `dark`: the app's light and dark theme.
- `2880` (2880×1800, retina) and `1440` (1440×900).
- `-framed`: the same image as a macOS window: 20px corners (40px at 2880), concentric with the app's content panel (12px corners, 8px in from the window), on a transparent background, a 1px border and the three traffic lights in the site's gray (`#d4d4d4` light, `#3f3f3f` dark, as in `components/screenshot.tsx`). Without it: the window content edge to edge, as the app renders it.

| Screen             | What it shows                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `faturalar-detail` | Faturalar, Son 3 ay: eleven invoices with totals and Taslak / Onaylı badges (two drafts, nine signed). The signed Northwind Labs invoice GIB2026000000023 ($7.640,00) is open: GİB's e-Arşiv preview with the QR code, PDF indir (Türkçe ve İngilizce), Tekrar kes.                                                                                                                                                                                                           |
| `yeni-fatura`      | Yeni fatura from Tekrar kes on GIB2026000000023, scrolled to Fatura: the Tarih and Son ödeme tarihi date fields (14 gün sonra), İstisna with 302 · Hizmet ihracatı, USD at TCMB's buying rate (45,1961, the 1 Ekim 2026 bulletin), and the first of the two services under Hizmetler (Yazılım geliştirme hizmeti, 1 × 6.500,00 $) with its Birim and KDV choices. The Özet card shows Genel toplam, TL karşılığı, the TR+EN PDF switch, Taslak oluştur and Oluştur ve onayla. |
| `yeni-start`       | Yeni fatura's start screen, "Geçen faturadan başla": the five newest invoices with Tekrar kes, and Boş fatura.                                                                                                                                                                                                                                                                                                                                                                |
| `musteriler`       | Müşteriler: five customers, Northwind Labs Inc. selected and scrolled to its Fatura varsayılanları (USD, İstisna, PDF TR+EN, KDV %0, Son ödeme tarihi 14 gün).                                                                                                                                                                                                                                                                                                                |
| `palette`          | The ⌘K command palette over Faturalar, filtered by "fatura": Yeni fatura (⌘N), Geçen ayın faturasını tekrar kes (highlighted) and Faturalar (⌘1). Unfiltered, its list scrolls and cuts the last group at the edge.                                                                                                                                                                                                                                                           |

The PDF is paper, so it has one version and no frame:

| File            | What it shows                                                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pdf-2880.webp` | Page 1 of the PDF of GIB2026000000023 as the app downloads it: minimal style, Turkish and English side by side, QR code, bank details. 2880×4073. |
| `pdf-1440.webp` | The same at 1440×2037.                                                                                                                            |

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
