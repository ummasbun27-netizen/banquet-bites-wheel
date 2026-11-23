# Yönetim paneli
- [x] Uygulamanın tüm yazılarını İngilizceye çevirme ve menü gizleme alanı dahil kontrol etme
- [x] Kalıcı menü ve kategori yönetimi
- [x] E-posta, hesap veya şifre gerektirmeyen yönetim paneli
- [x] Menü QR kodu ve indirme
- [x] QR bağlantısından hesapsız misafir menüsü
- [x] Mobil ve masaüstü kontrolü

- [x] Yayınlanan menü adresine yönlenen yazdırılabilir QR kodu

Yayınlama istendi. QR kodu yayın için belirlenen misafir menüsü adresini kullanır.
- [x] Yeni ürün eklerken yalnızca kendi fotoğrafını yükleme (hazır fotoğraflar kaldırıldı)
- [x] Daha sade ve anlaşılır yönetim paneli
- [x] Panelde ürünleri tek dokunuşla gizleme/gösterme
- [x] Misafir yorum kutusu: herkes yazabilir, yorumlar yalnızca yönetim panelinde görünür
- [x] Logonun solunda "Şans Çarkı" düğmesi, dokununca çark açılır
- [x] Çark ayarları Yönetim panelinde (Çark sekmesi); misafir çarkında ayar düğmesi yok
- [x] Menüde çark düğmesi solda küçük, sade bir simge
- [x] Yorum yaz düğmesi menünün üstünde görünür; yorum formunda isim alanı yok
- [x] Telefondaki çark simgesi belirgin ve dokunulabilir; yorum düğmesi alt kenarda sabit
- [x] Yorum düğmesi sağ altta küçük yuvarlak simge
- [x] Uygulama yönetim paneliyle açılır; misafir menüsü QR kodla açılan ayrı sayfada
- [x] Çarkı menüyle aynı görünümde, ayrı sayfa yüklemeden hızlı açma ve telefon kontrolü
- [x] Güvenlik: yorumlar gizli, çark hilesine karşı sunucu sınırı ve ödül kodları, fotoğraf yükleme sunucuda kontrollü
- [x] Yönetim paneline e-posta bağlantısıyla giriş; yalnızca onaylı adresler
- [x] Girişe yalnızca backend kullanıcı listesindeki hesaplar izinli (ummasbun27@gmail.com eklendi), herkese açık kayıt kapalı

## Yayın taşınabilirliği
- [x] Vercel ve Netlify hedefleri, IP başlığı sırası ve ortam değişkeni rehberi
- [ ] Vercel ve Netlify üzerinde canlı doğrulama (harici yayın ve sunucu anahtarları gerekir)
# Yeni menü
- [ ] İlk 10 ürünün fotoğrafını araştırılmış gerçek fotoğraflarla değiştir ve menüde kontrol et
- [x] Yüklenen menü fotoğrafındaki tüm ürünleri ekle, eski ürünleri sil, her ürüne fotoğraf ekle
- [x] Yorum penceresinde sosyal medya + takipçi (panelden düzenlenebilir)

## Çark sonuçları
- [x] Büyük ödül çıkmadığında çoğu zaman 10 Birr Off
- [x] 5 çevirmede 1 Maybe Next Time; günde ~3 kez arka arkaya iki Maybe Next Time
- [x] Aynı telefon arka arkaya iki kez kazanamaz: kazandıktan sonraki çevirme Maybe Next Time

# Veritabanı
- [x] Veritabanını Lovable Cloud ile bağla; menü, çark tabloları ve başlangıç verileri kuruldu
- [x] Kazanılan ödül kodları misafirin telefonunda o gün boyunca saklanır ve çark ekranında görünür
- [ ] Panel girişi: yalnızca ummasbun27@gmail.com, "Google ile giriş" düğmesi (e-posta bağlantısı kaldırıldı)
- [ ] Verileri kullanıcının kendi Supabase projesine taşıma (kullanıcı onayı bekleniyor)
