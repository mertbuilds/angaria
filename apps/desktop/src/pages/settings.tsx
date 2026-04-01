import { useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store.tsx";
import * as angaria from "@/lib/angaria.ts";

export function SettingsPage() {
  const {
    entities,
    activeEntity,
    activeEntityId,
    createEntity,
    renameEntity,
    deleteEntity,
    creds,
    setCreds,
    companyInfo,
    setCompanyInfo,
  } = useStore();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleForceLogout() {
    if (!creds.username || !creds.password) {
      toast.error("Kullanıcı adı ve şifre gerekli");
      return;
    }
    setLoggingOut(true);
    try {
      await angaria.forceLogout(creds.username, creds.password, creds.testMode);
      toast.success("Oturum kapatıldı");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Çıkış yapılamadı");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Varlık Yönetimi</CardTitle>
          <CardDescription>
            Her varlık kendi GİB hesabını, firma bilgisini ve şablonlarını tutar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border bg-muted/30 p-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-background">
              <Building2 className="size-4" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-sm font-medium">Aktif varlık</p>
                <p className="text-xs text-muted-foreground">
                  Sol alttaki menuden hızlıca varlık değiştirebilirsiniz.
                </p>
              </div>
              <Input
                value={activeEntity.name}
                onChange={(e) => renameEntity(activeEntityId, e.target.value)}
                placeholder="Varlık adı"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={createEntity}>
              <Plus className="size-4" />
              Yeni Varlık
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={entities.length === 1}
              onClick={() => deleteEntity(activeEntityId)}
            >
              <Trash2 className="size-4" />
              Varlığı Sil
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>GİB Kimlik Bilgileri</CardTitle>
          <CardDescription>
            e-Arşiv portal giriş bilgileriniz. Bilgileriniz yalnızca bu cihazda saklanır.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cred-user">Kullanıcı Adı</Label>
              <Input
                id="cred-user"
                value={creds.username}
                onChange={(e) => setCreds((c) => ({ ...c, username: e.target.value }))}
                placeholder="GİB kullanıcı adı"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cred-pass">Şifre</Label>
              <Input
                id="cred-pass"
                type="password"
                value={creds.password}
                onChange={(e) => setCreds((c) => ({ ...c, password: e.target.value }))}
                placeholder="GİB şifre"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="test-mode"
              checked={creds.testMode}
              onCheckedChange={(checked) => setCreds((c) => ({ ...c, testMode: checked }))}
            />
            <Label htmlFor="test-mode">Test modu (earsivportaltest.efatura.gov.tr)</Label>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Firma Bilgileri</CardTitle>
          <CardDescription>PDF faturalarınızda görünecek firma bilgileriniz.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Firma Adı / Ünvan</Label>
              <Input
                value={companyInfo.name}
                onChange={(e) => setCompanyInfo((c) => ({ ...c, name: e.target.value }))}
                placeholder="Firma Adı A.Ş."
              />
            </div>
            <div className="space-y-2">
              <Label>VKN / TCKN</Label>
              <Input
                value={companyInfo.taxID}
                onChange={(e) => setCompanyInfo((c) => ({ ...c, taxID: e.target.value }))}
                placeholder="1234567890"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Vergi Dairesi</Label>
            <Input
              value={companyInfo.taxOffice}
              onChange={(e) => setCompanyInfo((c) => ({ ...c, taxOffice: e.target.value }))}
              placeholder="Kadıköy"
            />
          </div>
          <div className="space-y-2">
            <Label>Adres</Label>
            <Textarea
              value={companyInfo.address}
              onChange={(e) => setCompanyInfo((c) => ({ ...c, address: e.target.value }))}
              placeholder="Tam adres"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input
                value={companyInfo.phone}
                onChange={(e) => setCompanyInfo((c) => ({ ...c, phone: e.target.value }))}
                placeholder="+90 555 123 45 67"
              />
            </div>
            <div className="space-y-2">
              <Label>E-posta</Label>
              <Input
                value={companyInfo.email}
                onChange={(e) => setCompanyInfo((c) => ({ ...c, email: e.target.value }))}
                placeholder="info@firma.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Banka Bilgileri</CardTitle>
          <CardDescription>PDF faturalarınızda görünecek banka hesap bilgileri.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Banka Adı</Label>
              <Input
                value={companyInfo.bankName}
                onChange={(e) => setCompanyInfo((c) => ({ ...c, bankName: e.target.value }))}
                placeholder="Ziraat Bankası"
              />
            </div>
            <div className="space-y-2">
              <Label>Hesap Sahibi</Label>
              <Input
                value={companyInfo.accountHolder}
                onChange={(e) => setCompanyInfo((c) => ({ ...c, accountHolder: e.target.value }))}
                placeholder="Ad Soyad"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>IBAN</Label>
              <Input
                value={companyInfo.iban}
                onChange={(e) => setCompanyInfo((c) => ({ ...c, iban: e.target.value }))}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
              />
            </div>
            <div className="space-y-2">
              <Label>Swift Kodu</Label>
              <Input
                value={companyInfo.swiftCode}
                onChange={(e) => setCompanyInfo((c) => ({ ...c, swiftCode: e.target.value }))}
                placeholder="TCZBTR2AXXX"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Banka Adresi</Label>
            <Textarea
              value={companyInfo.bankAddress}
              onChange={(e) => setCompanyInfo((c) => ({ ...c, bankAddress: e.target.value }))}
              placeholder="Banka şube adresi"
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Oturum Yönetimi</CardTitle>
          <CardDescription>GİB portalda açık kalmış oturumu kapatır.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            disabled={loggingOut || !creds.username || !creds.password}
            onClick={handleForceLogout}
          >
            {loggingOut ? "Çıkış yapılıyor..." : "Güvenli Çıkış (Oturumu Kapat)"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
