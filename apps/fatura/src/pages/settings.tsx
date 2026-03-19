import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store.tsx";

export function SettingsPage() {
  const { creds, setCreds } = useStore();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Ayarlar</h2>
        <p className="text-muted-foreground">GİB portal bağlantı ayarları</p>
      </div>

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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={creds.testMode}
              onChange={(e) => setCreds((c) => ({ ...c, testMode: e.target.checked }))}
              className="rounded border-input"
            />
            Test modu (earsivportaltest.efatura.gov.tr)
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
