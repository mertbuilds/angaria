import { Building2, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import * as angaria from '@/lib/angaria.ts';
import { useStore } from '@/lib/store.tsx';

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
      toast.error('Kullanıcı adı ve şifre gerekli');
      return;
    }
    setLoggingOut(true);
    try {
      await angaria.forceLogout(creds.username, creds.password, creds.testMode);
      toast.success('Oturum kapatıldı');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Çıkış yapılamadı');
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
                onChange={(e) => renameEntity(activeEntityId, e.target.value)}
                placeholder="Varlık adı"
                value={activeEntity.name}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={createEntity} type="button" variant="outline">
              <Plus className="size-4" />
              Yeni Varlık
            </Button>
            <Button
              disabled={entities.length === 1}
              onClick={() => deleteEntity(activeEntityId)}
              type="button"
              variant="outline"
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
                onChange={(e) => setCreds((c) => ({ ...c, username: e.target.value }))}
                placeholder="GİB kullanıcı adı"
                value={creds.username}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cred-pass">Şifre</Label>
              <Input
                id="cred-pass"
                onChange={(e) => setCreds((c) => ({ ...c, password: e.target.value }))}
                placeholder="GİB şifre"
                type="password"
                value={creds.password}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              checked={creds.testMode}
              id="test-mode"
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
                onChange={(e) => setCompanyInfo((c) => ({ ...c, name: e.target.value }))}
                placeholder="Firma Adı A.Ş."
                value={companyInfo.name}
              />
            </div>
            <div className="space-y-2">
              <Label>VKN / TCKN</Label>
              <Input
                onChange={(e) => setCompanyInfo((c) => ({ ...c, taxID: e.target.value }))}
                placeholder="1234567890"
                value={companyInfo.taxID}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Vergi Dairesi</Label>
            <Input
              onChange={(e) => setCompanyInfo((c) => ({ ...c, taxOffice: e.target.value }))}
              placeholder="Kadıköy"
              value={companyInfo.taxOffice}
            />
          </div>
          <div className="space-y-2">
            <Label>Adres</Label>
            <Textarea
              onChange={(e) => setCompanyInfo((c) => ({ ...c, address: e.target.value }))}
              placeholder="Tam adres"
              rows={3}
              value={companyInfo.address}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Telefon</Label>
              <Input
                onChange={(e) => setCompanyInfo((c) => ({ ...c, phone: e.target.value }))}
                placeholder="+90 555 123 45 67"
                value={companyInfo.phone}
              />
            </div>
            <div className="space-y-2">
              <Label>E-posta</Label>
              <Input
                onChange={(e) => setCompanyInfo((c) => ({ ...c, email: e.target.value }))}
                placeholder="info@firma.com"
                value={companyInfo.email}
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
                onChange={(e) => setCompanyInfo((c) => ({ ...c, bankName: e.target.value }))}
                placeholder="Ziraat Bankası"
                value={companyInfo.bankName}
              />
            </div>
            <div className="space-y-2">
              <Label>Hesap Sahibi</Label>
              <Input
                onChange={(e) => setCompanyInfo((c) => ({ ...c, accountHolder: e.target.value }))}
                placeholder="Ad Soyad"
                value={companyInfo.accountHolder}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>IBAN</Label>
              <Input
                onChange={(e) => setCompanyInfo((c) => ({ ...c, iban: e.target.value }))}
                placeholder="TR00 0000 0000 0000 0000 0000 00"
                value={companyInfo.iban}
              />
            </div>
            <div className="space-y-2">
              <Label>Swift Kodu</Label>
              <Input
                onChange={(e) => setCompanyInfo((c) => ({ ...c, swiftCode: e.target.value }))}
                placeholder="TCZBTR2AXXX"
                value={companyInfo.swiftCode}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Banka Adresi</Label>
            <Textarea
              onChange={(e) => setCompanyInfo((c) => ({ ...c, bankAddress: e.target.value }))}
              placeholder="Banka şube adresi"
              rows={2}
              value={companyInfo.bankAddress}
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
            disabled={loggingOut || !creds.username || !creds.password}
            onClick={handleForceLogout}
            variant="outline"
          >
            {loggingOut ? 'Çıkış yapılıyor...' : 'Güvenli Çıkış (Oturumu Kapat)'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
