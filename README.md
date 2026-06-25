# Yapay Zekâ Destekli Web Tabanlı Proje Yönetim Sistemi

## Proje Hakkında

Yapay Zekâ Destekli Web Tabanlı Yazılım Proje Yönetim Sistemi, yazılım ekiplerinin proje süreçlerini tek bir platform üzerinden yönetebilmesini sağlayan modern bir proje yönetim uygulamasıdır.

Sistem; proje oluşturma, ekip yönetimi, görev takibi, sprint planlama ve Kanban tabanlı iş akış yönetimi gibi temel proje yönetim özelliklerinin yanında yapay zekâ destekli analizler sunmaktadır.

Uygulama sayesinde ekip liderleri ve ekip üyeleri;

* Proje oluşturabilir ve ekip üyelerini davet edebilir.
* Görevleri oluşturabilir, düzenleyebilir ve takip edebilir.
* Sprint planlaması yapabilir.
* Kanban panosu üzerinden görev durumlarını yönetebilir.
* Gerçek zamanlı proje sohbeti gerçekleştirebilir.
* Yapay zekâ destekli görev önerileri alabilir.
* Sprint sonunda performans ve risk analiz raporları görüntüleyebilir.

---

## 🚀 Kullanılan Teknolojiler

### Frontend

* React.js
* Vite
* Tailwind CSS
* React Router DOM
* React Query
* Socket.io Client
* SweetAlert2

### Backend

* Node.js
* Express.js
* PostgreSQL
* Socket.io
* JWT Authentication
* bcrypt

### Yapay Zekâ Servisleri

* Google Gemini API
* Qwen API

---

## 📂 Proje Yapısı

```bash
project-root/
│
├── pgt-frontend/          # React tabanlı istemci uygulaması
├── pgt-backend/           # Node.js + Express sunucusu
├── README.md
└── database.sql       # Veritabanı oluşturma scriptleri
```

---

# ⚙️ Gereksinimler

Sistemi çalıştırabilmek için aşağıdaki yazılımların kurulu olması gerekmektedir:

* Node.js (v18 veya üzeri)
* npm
* PostgreSQL
* Git

---

# 🔧 Kurulum

## 1. Projeyi Klonlayın

```bash
git clone <repo-link>
cd proje-klasoru
```

---

## 2. Backend Kurulumu

Backend klasörüne geçin:

```bash
cd pgt-backend
```

Gerekli paketleri yükleyin:

```bash
npm install
```

### Kullanılan Başlıca Paketler

```bash
npm install express cors dotenv pg sequelize
npm install bcrypt jsonwebtoken
npm install socket.io
npm install multer
npm install axios
npm install uuid
npm install nodemon --save-dev
```

### .env Dosyasını Oluşturun

Backend klasöründe `.env` dosyası oluşturun:

```env
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=project_management_db
DB_USER=postgres
DB_PASSWORD=your_password

JWT_SECRET=your_secret_key

GEMINI_API_KEY=your_api_key

QWEN_API_KEY=your_api_key
QWEN_MODEL=qwen-plus
QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

Backend'i başlatın:

```bash
npm start
```

Sunucu varsayılan olarak:

```bash
http://localhost:5000
```

adresinde çalışacaktır.

---

## 3. Frontend Kurulumu

Yeni terminal açın:

```bash
cd pgt-frontend
```

Paketleri yükleyin:

```bash
npm install
```

### Kullanılan Başlıca Paketler

```bash
npm install react-router-dom
npm install axios
npm install @tanstack/react-query
npm install socket.io-client
npm install sweetalert2
npm install framer-motion
npm install react-icons
```

### Frontend .env Dosyası

```env
VITE_API_URL=http://localhost:5000
```

Frontend uygulamasını çalıştırın:

```bash
npm run dev
```

Uygulama aşağıdaki adreste çalışacaktır:

```bash
http://localhost:5173
```

---

# 🗄️ Veritabanı Kurulumu

1. PostgreSQL üzerinde yeni bir veritabanı oluşturun:

```sql
CREATE DATABASE project_management_db;
```

2. Proje içerisindeki SQL dosyalarını çalıştırarak tabloları oluşturun.

Örnek:

```bash
psql -U postgres -d project_management_db -f database.sql
```

---

# ▶️ Sistemi Çalıştırma Adımları

1. PostgreSQL servisini başlatın.
2. Backend klasöründe:

```bash
npm start
```

komutunu çalıştırın.

3. Frontend klasöründe:

```bash
npm run dev
```

komutunu çalıştırın.

4. Tarayıcıdan:

```bash
http://localhost:5173
```

adresine gidin.

---

# ✨ Temel Özellikler

* Kullanıcı kayıt ve giriş sistemi
* JWT tabanlı kimlik doğrulama
* Proje oluşturma ve yönetme
* Ekip üyelerini davet etme
* Sprint yönetimi
* Kanban görev takibi
* Görev bağımlılıkları
* Gerçek zamanlı proje sohbeti
* Yapay zekâ destekli görev önerileri
* İş yükü analizi
* Sprint raporları
* Risk analizi
* Bildirim sistemi

---

# 👨‍💻 Geliştirici

**Emine Esra Çetin**
İstanbul Topkapı Üniversitesi
Yazılım Mühendisliği Bölümü

---

# 📄 Lisans

Bu proje, İstanbul Topkapı Üniversitesi Yazılım Mühendisliği Bölümü Bitirme Projesi kapsamında geliştirilmiştir.
