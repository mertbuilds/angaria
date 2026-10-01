// The Turkish texts the emulator answers with. The first group is verified:
// the SDK, PR #1 and the open-source clients it was based on (f/fatura,
// mlevent/fatura) saw them on the live portal. The rest are best-effort
// wording; nothing in Angaria matches on them.

export const messages = {
  // Verified.
  /** A second login while a session is open. */
  sessionLocked:
    "Sisteme aynı anda birden fazla giriş yapamazsınız. Lütfen 'Güvenli Çıkış' seçeneğini kullanarak çıkış yapınız.",
  /** EARSIV_PORTAL_FATURA_OLUSTUR succeeded. The SDK matches "başarıyla oluşturul". */
  draftCreated:
    'Faturanız başarıyla oluşturulmuştur. Düzenlenen Belgeler menüsünden faturanıza ulaşabilirsiniz.',
  /** A client-sent faturaUuid: HTTP 200 with this text in `data`, no error flag. */
  ettnRejected: 'Ettn ya eksik ya boş ya da 36 uzunluk sınırına uymuyor.',
  /** A draft list range over the limit, sent as a data row `[{ error }]`. */
  rangeTooLong: (days: number) => `Seçilen tarih aralığı ${days} günden fazla olamaz!`,
  /** A dispatch command the portal does not know. */
  serviceNotFound: 'Service Not Found',

  // Best-effort.
  deleted: (count: number) => `${count} adet belge başarıyla silinmiştir.`,
  deleteReasonMissing: 'Silme nedeni boş olamaz.',
  hsmNotAllowed: 'HSM cihazı ile imzalama yetkiniz yok.',
  hsmSigned: (count: number) => `${count} adet belge HSM cihazı ile imzalanmıştır.`,
  invalidCommand: 'Geçersiz işlem.',
  invalidCredentials: 'Kullanıcı adı veya şifre hatalı.',
  invalidDate: 'Geçerli bir tarih giriniz.',
  invalidRecipientID: 'Alıcı VKN/TCKN 10 veya 11 haneli olmalıdır.',
  invoiceNotFound: 'Belge bulunamadı.',
  itemsMissing: 'En az bir mal/hizmet satırı girilmelidir.',
  maintenance: 'Sistemde bakım çalışması yapılmaktadır. Lütfen daha sonra tekrar deneyiniz.',
  notDeletable: 'Onaylanmış belgeler silinemez, iptal talebi oluşturunuz.',
  phoneMismatch: 'Telefon numarası sistemde kayıtlı numara ile uyuşmuyor.',
  rangeReversed: 'Başlangıç tarihi bitiş tarihinden sonra olamaz!',
  sessionExpired: 'Oturumunuzun süresi dolmuştur. Lütfen tekrar giriş yapınız.',
  smsCodeWrong: 'Girilen şifre hatalı veya geçerlilik süresi dolmuştur.',
  smsOperationUnknown: 'İşlem bulunamadı. Lütfen yeni bir şifre isteyiniz.',
  smsSigned: 'Belgeleriniz başarıyla imzalanmıştır.',
  textError: 'Fatura oluşturulurken bir hata oluştu. Lütfen daha sonra tekrar deneyiniz.',
  userSaved: 'Kullanıcı bilgileriniz kaydedilmiştir.',
};
