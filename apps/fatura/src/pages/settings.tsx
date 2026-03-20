import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useStore } from "@/lib/store.tsx";
import * as angaria from "@/lib/angaria.ts";

export function SettingsPage() {
  const { creds, setCreds } = useStore();
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
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Ayarlar</h2>
        <p className="text-sm text-muted-foreground">GİB portal bağlantı ayarları</p>
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
          <div className="flex items-center gap-3">
            <Switch
              id="test-mode"
              checked={creds.testMode}
              onCheckedChange={(checked) => setCreds((c) => ({ ...c, testMode: checked }))}
            />
            <Label htmlFor="test-mode">Test modu (earsivportaltest.efatura.gov.tr)</Label>
          </div>
          <div className="border-t pt-4">
            <Button
              variant="outline"
              disabled={loggingOut || !creds.username || !creds.password}
              onClick={handleForceLogout}
            >
              {loggingOut ? "Çıkış yapılıyor..." : "Güvenli Çıkış (Oturumu Kapat)"}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground">
              GİB portalda açık kalmış oturumu kapatır
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
