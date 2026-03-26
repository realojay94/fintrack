import React, { Component, ErrorInfo, ReactNode, useState, useMemo, useEffect } from 'react';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Wallet, 
  PlusCircle, 
  Trash2, 
  PieChart as PieChartIcon,
  Coffee,
  Car,
  Home,
  ShoppingBag,
  HeartPulse,
  MoreHorizontal,
  LogOut,
  LogIn,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Sparkles,
  Search,
  Filter,
  Calendar,
  ChevronRight,
  Target,
  Settings,
  Lightbulb,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import Markdown from 'react-markdown';
import { GoogleGenAI } from "@google/genai";
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  setDoc, 
  getDoc,
  FirebaseUser
} from './firebase';

// --- TYPES ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

interface Transaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category: { name: string; color: string } | null;
  date: string;
  uid: string;
}

// --- HELPER LOGIC: AUTO CLUSTERING ---
const EXPENSE_CATEGORIES = [
  { name: 'Konsumsi', keywords: ['makan', 'minum', 'kopi', 'gofood', 'snack', 'restoran', 'warung', 'groceries', 'belanja bulanan', 'indomaret', 'alfamart', 'starbuck', 'starbucks', 'starbak', 'cafe', 'kafe', 'mcd', 'kfc', 'roti', 'jajan', 'janji jiwa', 'jiwa', 'kopi kenangan', 'fore'], icon: Coffee, color: 'bg-orange-500', hex: '#f97316' },
  { name: 'Transportasi', keywords: ['bensin', 'parkir', 'tol', 'gojek', 'grab', 'kereta', 'bus', 'tiket', 'bengkel', 'maxim', 'krl', 'mrt', 'pesawat', 'ojek', 'go-jek'], icon: Car, color: 'bg-blue-500', hex: '#3b82f6' },
  { name: 'Tagihan & Utilitas', keywords: ['listrik', 'air', 'internet', 'wifi', 'pulsa', 'kuota', 'pdam', 'pln', 'cicilan', 'kos', 'sewa', 'asuransi', 'bpjs'], icon: Home, color: 'bg-purple-500', hex: '#a855f7' },
  { name: 'Belanja & Hiburan', keywords: ['baju', 'sepatu', 'bioskop', 'netflix', 'spotify', 'game', 'mainan', 'shopee', 'tokopedia', 'skincare', 'makeup', 'nonton', 'langganan'], icon: ShoppingBag, color: 'bg-pink-500', hex: '#ec4899' },
  { name: 'Kesehatan', keywords: ['dokter', 'obat', 'apotek', 'rumah sakit', 'klinik', 'vitamin', 'rs', 'checkup'], icon: HeartPulse, color: 'bg-red-500', hex: '#ef4444' },
  { name: 'Lainnya', keywords: [], icon: MoreHorizontal, color: 'bg-gray-500', hex: '#6b7280' }
];

const categorizeExpense = (description: string) => {
  const desc = description.toLowerCase().trim();
  for (let cat of EXPENSE_CATEGORIES) {
    if (cat.keywords.some(kw => desc.includes(kw))) {
      return { name: cat.name, icon: cat.icon, color: cat.color };
    }
  }
  return { name: 'Lainnya', icon: MoreHorizontal, color: 'bg-gray-500' };
};

const getCategoryByName = (name: string) => {
  const found = EXPENSE_CATEGORIES.find(c => c.name === name);
  return found ? { name: found.name, icon: found.icon, color: found.color } : { name: 'Lainnya', icon: MoreHorizontal, color: 'bg-gray-500' };
};

// --- UTILS ---
const cn = (...inputs: any[]) => {
  return inputs.filter(Boolean).join(' ');
};

// --- CONSTANTS ---
const FINANCIAL_TIPS = [
  "Sisihkan minimal 10% dari gaji untuk tabungan sebelum belanja.",
  "Catat setiap pengeluaran, sekecil apapun, untuk melacak kebocoran dana.",
  "Gunakan metode 50/30/20: 50% kebutuhan, 30% keinginan, 20% tabungan.",
  "Hindari belanja impulsif dengan menunggu 24 jam sebelum membeli barang non-esensial.",
  "Siapkan dana darurat minimal 3-6 kali pengeluaran bulanan.",
  "Bandingkan harga di minimal 3 toko sebelum membeli barang mahal.",
  "Masak di rumah lebih sering untuk menghemat biaya makan di luar.",
  "Matikan lampu dan alat elektronik yang tidak digunakan untuk hemat tagihan.",
  "Gunakan transportasi umum atau jalan kaki jika jarak memungkinkan.",
  "Berhenti berlangganan layanan yang jarang Anda gunakan.",
  "Investasikan waktu untuk belajar literasi keuangan setiap minggu.",
  "Jangan pernah berhutang untuk konsumsi barang yang nilainya turun.",
  "Mulai investasi sedini mungkin untuk memanfaatkan bunga majemuk.",
  "Diversifikasikan investasi Anda untuk mengurangi risiko.",
  "Tinjau kembali anggaran bulanan Anda di akhir setiap bulan.",
  "Bawa botol minum sendiri saat bepergian untuk hemat biaya minum.",
  "Gunakan daftar belanja saat ke supermarket agar tidak membeli yang tidak perlu.",
  "Manfaatkan diskon dan promo, tapi jangan membeli hanya karena sedang diskon.",
  "Perbaiki barang yang rusak daripada langsung membeli yang baru.",
  "Tetapkan tujuan keuangan yang spesifik, terukur, dan realistis.",
  "Bayar tagihan tepat waktu untuk menghindari denda keterlambatan.",
  "Gunakan kartu kredit dengan bijak, bayar lunas setiap bulan.",
  "Cari penghasilan tambahan dari hobi atau keahlian Anda.",
  "Jangan membandingkan gaya hidup Anda dengan orang lain di media sosial.",
  "Ajarkan anak-anak tentang nilai uang sejak dini.",
  "Evaluasi asuransi Anda secara berkala untuk memastikan perlindungan optimal.",
  "Beli barang berkualitas yang tahan lama meskipun harganya sedikit lebih mahal.",
  "Gunakan aplikasi atau buku catatan untuk memantau aset dan hutang.",
  "Hindari gaya hidup 'gali lubang tutup lubang'.",
  "Rayakan pencapaian keuangan kecil Anda sebagai motivasi.",
  "Pahami perbedaan antara kebutuhan dan keinginan.",
  "Jangan menaruh semua telur dalam satu keranjang (diversifikasi).",
  "Baca buku tentang manajemen keuangan pribadi.",
  "Gunakan uang tunai untuk belanja harian agar lebih terasa pengeluarannya.",
  "Siapkan dana khusus untuk hari raya atau liburan jauh-jauh hari.",
  "Cek saldo rekening secara berkala untuk menghindari biaya admin tak terduga.",
  "Jangan mudah tergiur dengan investasi yang menjanjikan keuntungan tidak masuk akal.",
  "Zakat dan sedekah tidak akan membuat Anda miskin, justru membawa berkah.",
  "Gunakan fitur auto-debet untuk menabung agar lebih disiplin.",
  "Beli baju saat sedang pergantian musim atau diskon besar.",
  "Rawat aset Anda (kendaraan, gadget) agar tidak cepat rusak.",
  "Pahami biaya tersembunyi saat membeli aset (pajak, perawatan).",
  "Jangan meminjamkan uang jika Anda sendiri sedang kesulitan keuangan.",
  "Gunakan perpustakaan atau pinjam buku daripada selalu membeli baru.",
  "Cari hiburan gratis seperti taman kota atau museum di hari tertentu.",
  "Kurangi kebiasaan jajan kopi atau snack di luar rumah.",
  "Gunakan energi matahari atau ventilasi alami untuk hemat listrik.",
  "Pahami profil risiko Anda sebelum mulai berinvestasi saham atau kripto.",
  "Jangan panik saat pasar investasi turun, tetap pada rencana jangka panjang.",
  "Konsultasikan rencana keuangan besar dengan pasangan atau keluarga.",
  "Pastikan Anda memiliki asuransi kesehatan yang memadai.",
  "Gunakan poin reward atau cashback dari transaksi Anda.",
  "Jangan biarkan uang menganggur di rekening tabungan biasa, pindahkan ke instrumen lain.",
  "Pelajari cara mengisi SPT pajak sendiri agar lebih paham aturan.",
  "Hindari lingkungan yang mendorong Anda untuk boros.",
  "Fokus pada menambah penghasilan, bukan hanya memotong pengeluaran.",
  "Gunakan aplikasi perbandingan harga untuk belanja online.",
  "Jangan membeli gadget terbaru hanya karena gengsi.",
  "Siapkan dana pendidikan anak sejak mereka lahir.",
  "Pahami kontrak pinjaman dengan teliti sebelum menandatangani.",
  "Gunakan diskon kartu member untuk belanja rutin.",
  "Beli barang dalam jumlah besar (bulk) untuk barang yang awet dan sering dipakai.",
  "Jangan lupakan biaya hiburan dalam anggaran agar tidak stres.",
  "Gunakan transportasi online hanya saat mendesak.",
  "Berhenti merokok atau kurangi kebiasaan buruk yang menguras kantong.",
  "Tanam sayuran atau bumbu dapur sendiri di rumah jika ada lahan.",
  "Gunakan air secukupnya dan perbaiki kebocoran pipa segera.",
  "Pahami cara kerja kartu kredit and bunga yang dikenakan.",
  "Jangan berhutang kepada teman atau keluarga jika tidak sangat mendesak.",
  "Miliki asuransi jiwa jika Anda adalah pencari nafkah utama.",
  "Gunakan tabungan emas sebagai alternatif investasi aman.",
  "Pelajari analisis fundamental sederhana sebelum beli saham.",
  "Jangan terpengaruh FOMO (Fear Of Missing Out) dalam investasi.",
  "Siapkan dana untuk perawatan kesehatan gigi secara rutin.",
  "Gunakan kupon atau voucher saat makan di restoran.",
  "Jangan biarkan kartu kredit mencapai limit maksimal.",
  "Pahami biaya admin bank dan cari yang paling kompetitif.",
  "Gunakan uang bonus atau THR untuk melunasi hutang atau investasi.",
  "Jangan membeli mobil baru jika mobil bekas masih layak pakai.",
  "Pelajari cara mengelola pajak UMKM jika Anda punya bisnis sampingan.",
  "Gunakan asuransi perjalanan saat bepergian ke luar negeri.",
  "Jangan lupakan inflasi saat menghitung target dana pensiun.",
  "Gunakan aplikasi pengingat tagihan agar tidak lupa bayar.",
  "Jangan membeli barang hanya karena 'mumpung lagi murah'.",
  "Pahami hak-hak Anda sebagai konsumen keuangan.",
  "Gunakan dana darurat hanya untuk keadaan yang benar-benar darurat.",
  "Jangan berinvestasi menggunakan uang panas (uang untuk kebutuhan pokok).",
  "Pelajari cara negosiasi gaji atau harga barang.",
  "Gunakan fitur 'wishlist' and tunggu diskon sebelum membeli.",
  "Jangan biarkan emosi mengendalikan keputusan keuangan Anda.",
  "Siapkan dana untuk perbaikan rumah secara berkala.",
  "Gunakan asuransi kendaraan untuk melindungi aset transportasi Anda.",
  "Jangan lupakan biaya pajak bumi dan bangunan (PBB) setiap tahun.",
  "Gunakan aplikasi e-wallet dengan bijak, jangan biarkan saldo mengendap terlalu banyak.",
  "Pelajari cara kerja reksadana sebagai langkah awal investasi.",
  "Jangan membeli barang KW, lebih baik merk lokal yang berkualitas.",
  "Gunakan promo 'buy 1 get 1' dengan teman untuk berbagi biaya.",
  "Jangan biarkan hutang kartu kredit berbunga-bunga.",
  "Pahami manfaat and risiko asuransi unit link.",
  "Gunakan dana sosial untuk membantu sesama secara terencana.",
  "Jangan lupakan biaya parkir and tol dalam anggaran transportasi.",
  "Gunakan fitur 'incognito' saat mencari tiket pesawat online.",
  "Jangan membeli barang yang tidak Anda pahami cara kerjanya.",
  "Pelajari cara membuat laporan keuangan sederhana untuk diri sendiri.",
  "Gunakan asuransi properti untuk melindungi rumah dari risiko kebakaran.",
  "Jangan lupakan biaya servis rutin kendaraan agar tetap awet.",
  "Gunakan aplikasi cashback saat belanja di e-commerce.",
  "Jangan biarkan uang receh tercecer, kumpulkan dalam celengan.",
  "Pahami aturan waris and wasiat untuk perencanaan masa depan.",
  "Gunakan dana hiburan untuk pengalaman, bukan hanya barang.",
  "Jangan lupakan biaya langganan aplikasi di smartphone.",
  "Gunakan fitur 'limit' pada aplikasi perbankan untuk keamanan.",
  "Pelajari cara investasi di pasar uang untuk likuiditas tinggi.",
  "Jangan membeli barang hanya karena sedang tren.",
  "Gunakan asuransi pendidikan untuk menjamin masa depan anak.",
  "Jangan lupakan biaya administrasi saat melakukan transfer antar bank.",
  "Gunakan aplikasi investasi yang terdaftar and diawasi OJK.",
  "Jangan biarkan tagihan kartu kredit menumpuk.",
  "Pahami perbedaan antara investasi and spekulasi.",
  "Gunakan dana cadangan untuk peluang investasi yang muncul tiba-tiba.",
  "Jangan lupakan biaya pemeliharaan gadget (case, screen protector).",
  "Gunakan fitur 'auto-save' pada aplikasi belanja.",
  "Pelajari cara mengelola keuangan saat terjadi krisis ekonomi.",
  "Jangan membeli barang yang hanya akan dipakai sekali.",
  "Gunakan asuransi kesehatan tambahan jika plafon kantor kurang.",
  "Jangan lupakan biaya iuran warga atau keamanan lingkungan.",
  "Gunakan aplikasi pencatat hutang jika Anda meminjamkan uang.",
  "Jangan biarkan gaya hidup meningkat seiring kenaikan gaji (lifestyle creep).",
  "Pahami cara kerja obligasi negara sebagai investasi aman.",
  "Gunakan dana khusus untuk hobi agar tidak mengganggu pos lain.",
  "Jangan lupakan biaya perpanjangan SIM and STNK.",
  "Gunakan fitur 'split bill' saat makan bersama teman.",
  "Pelajari cara mengoptimalkan pengembalian pajak (tax refund).",
  "Jangan membeli barang yang perawatannya sangat mahal.",
  "Gunakan asuransi penyakit kritis untuk perlindungan ekstra.",
  "Jangan lupakan biaya kuota internet untuk bekerja dari rumah.",
  "Gunakan aplikasi dompet digital yang memberikan banyak promo.",
  "Jangan biarkan uang tunai terlalu banyak di dompet.",
  "Pahami risiko investasi di sektor properti.",
  "Gunakan dana darurat untuk biaya medis yang tidak terduga.",
  "Jangan lupakan biaya kado untuk acara pernikahan atau ulang tahun.",
  "Gunakan fitur 'budgeting' pada aplikasi bank digital.",
  "Pelajari cara investasi di pasar modal melalui aplikasi sekuritas.",
  "Jangan membeli barang yang tidak memiliki garansi resmi.",
  "Gunakan asuransi tanggung gugat jika Anda memiliki bisnis.",
  "Jangan lupakan biaya keanggotaan gym atau komunitas.",
  "Gunakan aplikasi pembanding asuransi untuk mendapatkan premi terbaik.",
  "Jangan biarkan investasi Anda tidak terpantau.",
  "Pahami cara kerja deposito and penalti pencairan awal.",
  "Gunakan dana khusus untuk pengembangan diri (kursus, seminar).",
  "Jangan lupakan biaya kirim (ongkir) saat belanja online.",
  "Gunakan fitur 'round up' pada aplikasi tabungan.",
  "Pelajari cara mengelola keuangan keluarga secara transparan.",
  "Jangan membeli barang yang hanya untuk pamer.",
  "Gunakan asuransi perjalanan tahunan jika sering bepergian.",
  "Jangan lupakan biaya langganan TV kabel atau streaming film.",
  "Gunakan aplikasi manajemen password untuk keamanan akun keuangan.",
  "Jangan biarkan hutang konsumtif menguasai hidup Anda.",
  "Pahami risiko investasi di sektor bisnis startup.",
  "Gunakan dana sosial untuk membantu keluarga yang membutuhkan.",
  "Jangan lupakan biaya administrasi penarikan uang di ATM.",
  "Gunakan fitur 'lock' pada kartu kredit jika tidak digunakan.",
  "Pelajari cara investasi di instrumen syariah jika sesuai prinsip Anda.",
  "Jangan membeli barang yang tidak Anda butuhkan sekarang.",
  "Gunakan asuransi kesehatan untuk orang tua Anda.",
  "Jangan lupakan biaya renovasi kecil di rumah.",
  "Gunakan aplikasi pelacak paket untuk memastikan barang belanjaan sampai.",
  "Jangan biarkan emosi saat sedih membuat Anda belanja berlebihan (retail therapy).",
  "Pahami cara kerja peer-to-peer lending and risikonya.",
  "Gunakan dana khusus untuk zakat mal and fitrah.",
  "Jangan lupakan biaya iuran kartu kredit tahunan.",
  "Gunakan fitur 'virtual card' untuk transaksi online yang lebih aman.",
  "Pelajari cara mengelola keuangan saat masa pensiun tiba.",
  "Jangan membeli barang yang tidak bisa Anda jual kembali dengan harga layak.",
  "Gunakan asuransi jiwa berjangka (term life) yang lebih murah.",
  "Jangan lupakan biaya pemeliharaan taman atau kolam di rumah.",
  "Gunakan aplikasi perbandingan bunga pinjaman.",
  "Jangan biarkan uang Anda 'tidur' di bawah bantal.",
  "Pahami risiko investasi di komoditas seperti minyak atau gandum.",
  "Gunakan dana darurat untuk biaya perbaikan kendaraan yang mendadak.",
  "Jangan lupakan biaya iuran sekolah atau kuliah.",
  "Gunakan fitur 'scheduled transfer' untuk bayar cicilan.",
  "Pelajari cara investasi di pasar valuta asing (forex) dengan hati-hati.",
  "Jangan membeli barang yang hanya akan menambah tumpukan di rumah.",
  "Gunakan asuransi kesehatan internasional jika sering ke luar negeri.",
  "Jangan lupakan biaya langganan koran atau majalah digital.",
  "Gunakan aplikasi pengelola pengeluaran yang bisa sinkron antar perangkat.",
  "Jangan biarkan hutang piutang merusak hubungan pertemanan.",
  "Pahami risiko investasi di barang koleksi (jam tangan, tas mewah).",
  "Gunakan dana khusus untuk perayaan ulang tahun anak.",
  "Jangan lupakan biaya administrasi saat melakukan penutup rekening bank.",
  "Gunakan fitur 'biometric login' untuk keamanan aplikasi keuangan.",
  "Pelajari cara mengelola keuangan saat menjadi orang tua tunggal.",
  "Jangan membeli barang yang biaya operasionalnya sangat tinggi.",
  "Gunakan asuransi jiwa seumur hidup (whole life) untuk warisan.",
  "Jangan lupakan biaya pembersihan AC secara rutin.",
  "Gunakan aplikasi pembanding harga tiket hotel.",
  "Jangan biarkan tabungan Anda tergerus inflasi tanpa investasi.",
  "Pahami risiko investasi di sektor energi terbarukan.",
  "Gunakan dana darurat untuk biaya renovasi rumah yang mendesak.",
  "Jangan lupakan biaya iuran keanggotaan profesi.",
  "Gunakan fitur 'spending limit' pada kartu debit.",
  "Pelajari cara investasi di instrumen derivatif dengan sangat hati-hati.",
  "Jangan membeli barang yang tidak ramah lingkungan.",
  "Gunakan asuransi kesehatan untuk hewan peliharaan jika perlu.",
  "Jangan lupakan biaya langganan cloud storage untuk data Anda.",
  "Gunakan aplikasi pengelola tagihan yang bisa otomatis bayar.",
  "Jangan biarkan hutang pajak menumpuk.",
  "Pahami risiko investasi di sektor teknologi informasi.",
  "Gunakan dana khusus untuk membantu korban bencana alam.",
  "Jangan lupakan biaya administrasi saat melakukan top up e-wallet.",
  "Gunakan fitur 'two-factor authentication' pada semua akun keuangan.",
  "Pelajari cara mengelola keuangan saat pindah ke luar kota atau luar negeri.",
  "Jangan membeli barang yang tidak memiliki suku cadang yang mudah dicari.",
  "Gunakan asuransi kesehatan syariah untuk ketenangan pikiran.",
  "Jangan lupakan biaya pemeliharaan sistem keamanan rumah.",
  "Gunakan aplikasi perbandingan harga sewa kendaraan.",
  "Jangan biarkan keinginan untuk cepat kaya membuat Anda terjebak penipuan.",
  "Pahami risiko investasi di sektor pertambangan.",
  "Gunakan dana darurat untuk biaya pemakaman keluarga yang mendadak.",
  "Jangan lupakan biaya iuran keanggotaan klub olahraga.",
  "Gunakan fitur 'cashback' pada aplikasi transportasi online.",
  "Pelajari cara investasi di sektor agribisnis.",
  "Jangan membeli barang yang hanya akan digunakan untuk sekali acara.",
  "Gunakan asuransi jiwa unit link dengan porsi proteksi lebih besar.",
  "Jangan lupakan biaya langganan aplikasi musik tanpa iklan.",
  "Gunakan aplikasi pengelola keuangan yang memiliki fitur AI.",
  "Jangan biarkan hutang menghambat impian Anda.",
  "Pahami risiko investasi di sektor ritel.",
  "Gunakan dana khusus untuk biaya mudik atau pulang kampung.",
  "Jangan lupakan biaya administrasi saat melakukan pencairan reksadana.",
  "Gunakan fitur 'freeze' pada aplikasi bank jika kartu hilang.",
  "Pelajari cara mengelola keuangan saat mendapatkan warisan.",
  "Jangan membeli barang yang tidak sesuai dengan kebutuhan Anda.",
  "Gunakan asuransi kesehatan untuk asisten rumah tangga.",
  "Jangan lupakan biaya pemeliharaan peralatan dapur.",
  "Gunakan aplikasi perbandingan harga perlengkapan bayi.",
  "Jangan biarkan rasa takut menghalangi Anda untuk mulai berinvestasi.",
  "Pahami risiko investasi di sektor perbankan.",
  "Gunakan dana darurat untuk biaya hukum yang tidak terduga.",
  "Jangan lupakan biaya iuran keanggotaan perpustakaan.",
  "Gunakan fitur 'points' pada aplikasi belanja untuk diskon.",
  "Pelajari cara investasi di sektor infrastruktur.",
  "Jangan membeli barang yang tidak memiliki ulasan positif.",
  "Gunakan asuransi jiwa untuk melindungi hutang KPR Anda.",
  "Jangan lupakan biaya langganan aplikasi desain atau produktivitas.",
  "Gunakan aplikasi pengelola keuangan yang bisa mencatat aset kripto.",
  "Jangan biarkan hutang membuat Anda stres and tidak produktif.",
  "Pahami risiko investasi di sektor manufaktur.",
  "Gunakan dana khusus untuk biaya kurban setiap tahun.",
  "Jangan lupakan biaya administrasi saat melakukan transfer internasional.",
  "Gunakan fitur 'alert' untuk setiap transaksi keluar di rekening.",
  "Pelajari cara mengelola keuangan saat menghadapi masa pengangguran.",
  "Jangan membeli barang yang tidak bisa Anda rawat sendiri.",
  "Gunakan asuransi kesehatan untuk perlindungan saat rawat jalan.",
  "Jangan lupakan biaya pemeliharaan atap rumah agar tidak bocor.",
  "Gunakan aplikasi perbandingan harga obat di apotek.",
  "Jangan biarkan keserakahan membuat Anda mengambil risiko terlalu tinggi.",
  "Pahami risiko investasi di sektor pariwisata.",
  "Gunakan dana darurat untuk biaya perbaikan gadget yang penting untuk kerja.",
  "Jangan lupakan biaya iuran keanggotaan komunitas hobi.",
  "Gunakan fitur 'referral' untuk mendapatkan bonus dari aplikasi keuangan.",
  "Pelajari cara investasi di sektor pendidikan.",
  "Jangan membeli barang yang tidak memiliki layanan purna jual.",
  "Gunakan asuransi jiwa untuk menjamin kelangsungan bisnis keluarga.",
  "Jangan lupakan biaya langganan aplikasi kesehatan atau meditasi.",
  "Gunakan aplikasi pengelola keuangan yang bisa mencatat logam mulia.",
  "Jangan biarkan hutang merusak reputasi profesional Anda.",
  "Pahami risiko investasi di sektor logistik.",
  "Gunakan dana khusus untuk biaya liburan singkat (staycation).",
  "Jangan lupakan biaya administrasi saat melakukan pembayaran kartu kredit.",
  "Gunakan fitur 'hide balance' pada aplikasi bank untuk privasi.",
  "Pelajari cara mengelola keuangan saat memiliki anak berkebutuhan khusus.",
  "Jangan membeli barang yang tidak memiliki sertifikasi keamanan.",
  "Gunakan asuransi kesehatan untuk perlindungan saat kehamilan.",
  "Jangan lupakan biaya pemeliharaan pagar and halaman rumah.",
  "Gunakan aplikasi perbandingan harga tiket bioskop.",
  "Jangan biarkan ketidaktahuan membuat Anda kehilangan uang.",
  "Pahami risiko investasi di sektor hiburan.",
  "Gunakan dana darurat untuk biaya perbaikan alat rumah tangga utama.",
  "Jangan lupakan biaya iuran keanggotaan asosiasi alumni.",
  "Gunakan fitur 'cash withdrawal' tanpa kartu di ATM.",
  "Pelajari cara investasi di sektor kesehatan.",
  "Jangan membeli barang yang tidak memberikan nilai tambah bagi hidup Anda.",
  "Gunakan asuransi jiwa untuk melindungi masa depan pasangan.",
  "Jangan lupakan biaya langganan aplikasi belajar bahasa asing.",
  "Gunakan aplikasi pengelola keuangan yang bisa mencatat properti.",
  "Jangan biarkan hutang menghalangi Anda untuk menabung.",
  "Pahami risiko investasi di sektor makanan and minuman.",
  "Gunakan dana khusus untuk biaya perbaikan gadget anak.",
  "Jangan lupakan biaya administrasi saat melakukan penukaran mata uang asing.",
  "Gunakan fitur 'biometric authentication' untuk transaksi e-wallet.",
  "Pelajari cara mengelola keuangan saat menjadi ekspatriat.",
  "Jangan membeli barang yang tidak Anda butuhkan hanya untuk mengisi waktu luang.",
  "Gunakan asuransi kesehatan untuk perlindungan saat di luar negeri.",
  "Jangan lupakan biaya pemeliharaan saluran air and septik tank.",
  "Gunakan aplikasi perbandingan harga sewa apartemen atau rumah.",
  "Jangan biarkan rasa malas membuat Anda tidak memantau keuangan.",
  "Pahami risiko investasi di sektor telekomunikasi.",
  "Gunakan dana darurat untuk biaya perbaikan sistem kelistrikan rumah.",
  "Jangan lupakan biaya iuran keanggotaan klub buku.",
  "Gunakan fitur 'promo code' saat melakukan transaksi online.",
  "Pelajari cara investasi di sektor energi.",
  "Jangan membeli barang yang tidak memiliki instruksi penggunaan yang jelas.",
  "Gunakan asuransi jiwa untuk menjamin biaya pemakaman.",
  "Jangan lupakan biaya langganan aplikasi berita atau informasi bisnis.",
  "Gunakan aplikasi pengelola keuangan yang bisa mencatat koleksi barang berharga.",
  "Jangan biarkan hutang membuat Anda kehilangan kepercayaan diri.",
  "Pahami risiko investasi di sektor otomotif.",
  "Gunakan dana khusus untuk biaya perayaan hari jadi pernikahan.",
  "Jangan lupakan biaya administrasi saat melakukan pembayaran pajak.",
  "Gunakan fitur 'transaction history' untuk audit pengeluaran mingguan.",
  "Pelajari cara mengelola keuangan saat memiliki bisnis keluarga.",
  "Jangan membeli barang yang tidak memberikan kebahagiaan jangka panjang.",
  "Gunakan asuransi kesehatan untuk perlindungan dari penyakit menular.",
  "Jangan lupakan biaya pemeliharaan jendela and pintu rumah.",
  "Gunakan aplikasi perbandingan harga paket wisata.",
  "Jangan biarkan kesombongan membuat Anda tidak mau belajar keuangan.",
  "Pahami risiko investasi di sektor media.",
  "Gunakan dana darurat untuk biaya perbaikan atap yang bocor saat hujan.",
  "Jangan lupakan biaya iuran keanggotaan komunitas investasi.",
  "Gunakan fitur 'points exchange' untuk mendapatkan barang gratis.",
  "Pelajari cara investasi di sektor properti komersial.",
  "Jangan membeli barang yang tidak sesuai dengan gaya hidup sehat Anda.",
  "Gunakan asuransi jiwa untuk melindungi aset yang sedang dicicil.",
  "Jangan lupakan biaya langganan aplikasi produktivitas tim.",
  "Gunakan aplikasi pengelola keuangan yang bisa mencatat investasi P2P.",
  "Jangan biarkan hutang merusak masa depan Anda.",
  "Pahami risiko investasi di sektor jasa keuangan.",
  "Gunakan dana khusus untuk biaya perbaikan gadget pasangan.",
  "Jangan lupakan biaya administrasi saat melakukan transfer ke luar negeri.",
  "Gunakan fitur 'recurring payment' untuk tagihan rutin.",
  "Pelajari cara mengelola keuangan saat menghadapi perceraian.",
  "Jangan membeli barang yang tidak memiliki dukungan komunitas yang baik.",
  "Gunakan asuransi kesehatan untuk perlindungan dari kecelakaan kerja.",
  "Jangan lupakan biaya pemeliharaan dinding and cat rumah.",
  "Gunakan aplikasi perbandingan harga perlengkapan olahraga.",
  "Jangan biarkan rasa bersalah membuat Anda memberikan uang secara berlebihan.",
  "Pahami risiko investasi di sektor e-commerce.",
  "Gunakan dana darurat untuk biaya perbaikan kendaraan yang mogok.",
  "Jangan lupakan biaya iuran keanggotaan klub seni.",
  "Gunakan fitur 'referral code' untuk mendapatkan diskon belanja.",
  "Pelajari cara investasi di sektor teknologi finansial.",
  "Jangan membeli barang yang tidak memiliki standar kualitas nasional.",
  "Gunakan asuransi jiwa untuk menjamin kelangsungan pendidikan anak.",
  "Jangan lupakan biaya langganan aplikasi hiburan anak.",
  "Gunakan aplikasi pengelola keuangan yang bisa mencatat dana pensiun.",
  "Jangan biarkan hutang membuat Anda merasa terjebak.",
  "Pahami risiko investasi di sektor asuransi.",
  "Gunakan dana khusus untuk biaya perayaan kelulusan anak.",
  "Jangan lupakan biaya administrasi saat melakukan pembayaran iuran BPJS.",
  "Gunakan fitur 'security alert' untuk aktivitas login yang mencurigakan.",
  "Pelajari cara mengelola keuangan saat menjadi digital nomad.",
  "Jangan membeli barang yang tidak memberikan manfaat jangka panjang.",
  "Gunakan asuransi kesehatan untuk perlindungan dari penyakit kritis.",
  "Jangan lupakan biaya pemeliharaan sistem air minum di rumah.",
  "Gunakan aplikasi perbandingan harga perlengkapan rumah tangga.",
  "Jangan biarkan rasa takut ketinggalan membuat Anda boros.",
  "Pahami risiko investasi di sektor real estate.",
  "Gunakan dana darurat untuk biaya perbaikan gadget yang rusak total.",
  "Jangan lupakan biaya iuran keanggotaan komunitas pecinta alam.",
  "Gunakan fitur 'cashback' untuk setiap transaksi belanja bulanan.",
  "Pelajari cara investasi di sektor berkelanjutan.",
  "Jangan membeli barang yang tidak Anda butuhkan hanya untuk pamer di media sosial.",
  "Gunakan asuransi jiwa untuk melindungi keluarga dari beban hutang.",
  "Jangan lupakan biaya langganan aplikasi pengolah foto atau video.",
  "Gunakan aplikasi pengelola keuangan yang bisa mencatat tabungan emas.",
  "Jangan biarkan hutang merusak kedamaian pikiran Anda.",
  "Pahami risiko investasi di sektor energi fosil.",
  "Gunakan dana khusus untuk biaya perbaikan rumah yang mendadak.",
  "Jangan lupakan biaya administrasi saat melakukan pembayaran tagihan listrik.",
  "Gunakan fitur 'auto-debit' untuk menabung secara otomatis.",
  "Pelajari cara mengelola keuangan saat menghadapi masa pensiun dini.",
  "Jangan membeli barang yang tidak memberikan nilai tambah bagi produktivitas Anda.",
  "Gunakan asuransi kesehatan untuk perlindungan saat rawat inap.",
  "Jangan lupakan biaya pemeliharaan kendaraan agar tetap aman digunakan.",
  "Gunakan aplikasi perbandingan harga tiket kereta api.",
  "Jangan biarkan keinginan untuk terlihat kaya membuat Anda miskin.",
  "Pahami risiko investasi di sektor pertambangan emas.",
  "Gunakan dana darurat untuk biaya perbaikan rumah yang terkena bencana.",
  "Jangan lupakan biaya iuran keanggotaan klub pecinta hewan.",
  "Gunakan fitur 'discount' untuk setiap transaksi belanja di hari tertentu.",
  "Pelajari cara investasi di sektor teknologi medis.",
  "Jangan membeli barang yang tidak memiliki garansi purna jual.",
  "Gunakan asuransi jiwa untuk menjamin masa depan keluarga.",
  "Jangan lupakan biaya langganan aplikasi belajar online.",
  "Gunakan aplikasi pengelola keuangan yang bisa mencatat semua aset Anda.",
  "Jangan biarkan hutang menghambat langkah Anda menuju kebebasan finansial.",
  "Pahami risiko investasi di sektor properti residensial.",
  "Gunakan dana khusus untuk biaya perayaan hari raya keagamaan.",
  "Jangan lupakan biaya administrasi saat melakukan pembayaran tagihan air.",
  "Gunakan fitur 'budgeting' untuk mengontrol pengeluaran harian.",
  "Pelajari cara mengelola keuangan saat menghadapi krisis kesehatan.",
  "Jangan membeli barang yang tidak memberikan manfaat bagi kesehatan Anda.",
  "Gunakan asuransi kesehatan untuk perlindungan dari risiko kecelakaan.",
  "Jangan lupakan biaya pemeliharaan rumah agar tetap nyaman dihuni.",
  "Gunakan aplikasi perbandingan harga tiket bus.",
  "Jangan biarkan rasa iri membuat Anda menghabiskan uang secara tidak bijak.",
  "Pahami risiko investasi di sektor teknologi informasi and komunikasi.",
  "Gunakan dana darurat untuk biaya perbaikan gadget yang sangat diperlukan.",
  "Jangan lupakan biaya iuran keanggotaan komunitas sosial.",
  "Gunakan fitur 'reward' untuk setiap transaksi yang Anda lakukan.",
  "Pelajari cara investasi di sektor energi terbarukan and ramah lingkungan.",
  "Jangan membeli barang yang tidak memberikan kebahagiaan bagi Anda and keluarga.",
  "Gunakan asuransi jiwa untuk melindungi masa depan orang-orang yang Anda cintai.",
  "Jangan lupakan biaya langganan aplikasi yang memberikan informasi bermanfaat.",
  "Gunakan aplikasi pengelola keuangan yang mudah digunakan and aman.",
  "Jangan biarkan hutang mengendalikan hidup Anda, jadilah tuan atas uang Anda sendiri."
];

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- ERROR BOUNDARY ---
interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      let errorMessage = "Terjadi kesalahan yang tidak terduga.";
      try {
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.error.includes("insufficient permissions")) {
          errorMessage = "Anda tidak memiliki izin untuk melakukan operasi ini. Silakan hubungi administrator.";
        }
      } catch {
        // Not a JSON error
      }

      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-4">
            <div className="bg-rose-100 p-4 rounded-full w-fit mx-auto">
              <AlertCircle className="text-rose-600" size={32} />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Oops! Sesuatu Salah</h2>
            <p className="text-slate-600">{errorMessage}</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// --- AI SERVICE ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function getAIInsights(transactions: Transaction[], balance: number) {
  if (transactions.length === 0) return "Belum ada data transaksi untuk dianalisis. Mulailah mencatat pengeluaran Anda!";
  
  const summary = transactions.slice(0, 20).map(t => `${t.date}: ${t.type} ${t.amount} - ${t.description} (${t.category?.name || 'N/A'})`).join('\n');
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analisis data keuangan berikut dan berikan 3 saran singkat & praktis dalam Bahasa Indonesia. Format dalam markdown.\n\nSaldo saat ini: ${balance}\n\nTransaksi terakhir:\n${summary}`,
      config: {
        systemInstruction: "Anda adalah asisten keuangan pribadi yang cerdas. Berikan saran yang singkat, ramah, dan sangat praktis berdasarkan data transaksi user.",
      }
    });
    return response.text || "Gagal mendapatkan saran AI.";
  } catch (error) {
    console.error("AI Insight Error:", error);
    if (error instanceof Error && error.message.includes("API_KEY_INVALID")) {
      return "Kunci API tidak valid. Silakan periksa pengaturan API Key Anda.";
    }
    return "Maaf, asisten AI sedang mengalami gangguan teknis. Silakan coba beberapa saat lagi!";
  }
}

// --- COMPONENTS ---
const Card = ({ children, className, title, icon: Icon, extra }: { children: ReactNode, className?: string, title?: string, icon?: any, extra?: ReactNode }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn("bg-white rounded-3xl shadow-sm border border-slate-100 p-6 overflow-hidden relative", className)}
  >
    {title && (
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2 font-display">
          {Icon && <Icon size={20} className="text-brand-500" />}
          {title}
        </h3>
        {extra && <div>{extra}</div>}
      </div>
    )}
    {children}
  </motion.div>
);

const StatCard = ({ label, value, trend, type }: { label: string, value: string, trend?: string, type: 'balance' | 'income' | 'expense' }) => {
  const colors = {
    balance: "bg-brand-50 text-brand-600 border-brand-100",
    income: "bg-emerald-50 text-emerald-600 border-emerald-100",
    expense: "bg-rose-50 text-rose-600 border-rose-100"
  };
  
  return (
    <Card className={cn("border-l-4", colors[type])}>
      <p className="text-sm font-medium opacity-70 mb-1">{label}</p>
      <h2 className="text-2xl font-bold tracking-tight font-display">{value}</h2>
      {trend && (
        <div className="flex items-center gap-1 mt-2 text-xs font-semibold">
          {type === 'income' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trend}
        </div>
      )}
    </Card>
  );
};
const GOAL_PRESETS = ["Financial Freedom", "Dana Darurat", "Liburan", "Kendaraan", "Rumah", "Umum"];

const formatRupiah = (number: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(number);
};

// --- APP COMPONENT ---
function FinTrackApp() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const [transactionDate, setTransactionDate] = useState(getLocalDateString(new Date()));
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [selectedCategory, setSelectedCategory] = useState('Auto');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isGeneratingInsight, setIsGeneratingInsight] = useState(false);
  const [budget, setBudget] = useState(5000000);
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({});
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [tempBudget, setTempBudget] = useState('5000000');
  const [tempCategoryBudgets, setTempCategoryBudgets] = useState<Record<string, string>>({});
  const [isSuggestingBudget, setIsSuggestingBudget] = useState(false);
  
  const [savingGoals, setSavingGoals] = useState<{id: string, name: string, target: number, current: number, type?: string}[]>([]);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');
  const [goalType, setGoalType] = useState('Umum');
  const [goalYears, setGoalYears] = useState('1');
  const [goalPercentage, setGoalPercentage] = useState('10');
  const [isSuggestingGoal, setIsSuggestingGoal] = useState(false);
  const [aiGoalSuggestion, setAiGoalSuggestion] = useState<{target: number, years: number, percentage: number, reason: string} | null>(null);

  const [chartTab, setChartTab] = useState<'all' | 'income' | 'expense'>('all');
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('daily');
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDate());
  const [selectedWeek, setSelectedWeek] = useState<'all' | 1 | 2 | 3 | 4>('all');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [aiSuggestions, setAiSuggestions] = useState<{name: string, color: string}[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isAddingTransaction, setIsAddingTransaction] = useState(false);

  useEffect(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    if (selectedDay > daysInMonth) {
      setSelectedDay(daysInMonth);
    }
  }, [selectedMonth, selectedYear, selectedDay]);
  
  const getDayOfYear = (date: Date) => {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = (date.getTime() - start.getTime()) + ((start.getTimezoneOffset() - date.getTimezoneOffset()) * 60 * 1000);
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
  };

  const [isTipsModalOpen, setIsTipsModalOpen] = useState(false);
  const [activeTipIndex, setActiveTipIndex] = useState(getDayOfYear(new Date()) - 1);

  const getTipDate = (index: number) => {
    const date = new Date(new Date().getFullYear(), 0, 1);
    date.setDate(date.getDate() + index);
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const [isBudgetSuggestionOpen, setIsBudgetSuggestionOpen] = useState(false);
  const [suggestedBudget, setSuggestedBudget] = useState(0);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
      if (currentUser) {
        // Sync user to Firestore
        const userRef = doc(db, 'users', currentUser.uid);
        try {
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            await setDoc(userRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              photoURL: currentUser.photoURL,
              role: 'user',
              budget: 5000000
            });
          } else {
            setBudget(userDoc.data().budget || 5000000);
            setTempBudget((userDoc.data().budget || 5000000).toString());
            const catBudgets = userDoc.data().categoryBudgets || {};
            setCategoryBudgets(catBudgets);
            const tempCatBudgets: Record<string, string> = {};
            Object.entries(catBudgets).forEach(([cat, val]) => {
              tempCatBudgets[cat] = String(val);
            });
            setTempCategoryBudgets(tempCatBudgets);
          }
        } catch (error) {
          console.error("Error syncing user:", error);
        }
      } else {
        setTransactions([]);
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listener
  useEffect(() => {
    if (!isAuthReady || !user) return;

    setIsLoading(true);
    const q = query(
      collection(db, 'transactions'),
      where('uid', '==', user.uid)
      // orderBy removed temporarily to avoid index issues
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Transaction[];
      
      // Sort manually if orderBy is removed
      data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      
      setTransactions(data);
      setIsLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'transactions');
    });

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // Saving Goals Listener
  useEffect(() => {
    if (!isAuthReady || !user) return;

    const q = query(collection(db, 'saving_goals'), where('uid', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setSavingGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'saving_goals'));

    return () => unsubscribe();
  }, [isAuthReady, user]);

  // Calculations
  useEffect(() => {
    if (timeframe === 'weekly' && selectedWeek === 'all') {
      const today = new Date();
      if (today.getFullYear() === selectedYear && today.getMonth() === selectedMonth) {
        const week = Math.ceil(today.getDate() / 7);
        setSelectedWeek(week as any);
      }
    }
  }, [timeframe, selectedMonth, selectedYear]);

  const parseLocalDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  const groupedTransactions = useMemo(() => {
    const filtered = transactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           (t.category?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || t.type === filterType;
      const matchesCategory = filterCategory === 'all' || t.category?.name === filterCategory;
      return matchesSearch && matchesType && matchesCategory;
    });

    const groups: Record<string, Transaction[]> = {};
    filtered.forEach(t => {
      const date = parseLocalDate(t.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
      if (!groups[date]) groups[date] = [];
      groups[date].push(t);
    });
    return Object.entries(groups);
  }, [transactions, searchQuery, filterType, filterCategory]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    years.add(new Date().getFullYear());
    transactions.forEach(t => {
      const y = new Date(t.date).getFullYear();
      if (!isNaN(y)) years.add(y);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [transactions]);

  const chartData = useMemo(() => {
    if (timeframe === 'daily') {
      // Show 7 days around selected day
      const days = [...Array(7)].map((_, i) => {
        const d = new Date(selectedYear, selectedMonth, selectedDay);
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split('T')[0];
      });

      return days.map(date => {
        const dayTransactions = transactions.filter(t => t.date.startsWith(date));
        const income = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        return {
          date: parseLocalDate(date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
          income,
          expense,
          net: income - expense
        };
      });
    }

    if (timeframe === 'weekly') {
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const numWeeks = Math.ceil(daysInMonth / 7);
      const weeks = Array.from({ length: numWeeks }, (_, i) => i + 1);

      if (selectedWeek === 'all') {
        return weeks.map(w => {
          const start = new Date(selectedYear, selectedMonth, (w - 1) * 7 + 1);
          let end = new Date(selectedYear, selectedMonth, w * 7 + 1);
          if (w === numWeeks) end = new Date(selectedYear, selectedMonth + 1, 1);
          
          const periodTransactions = transactions.filter(t => {
            const td = new Date(t.date);
            return td >= start && td < end;
          });

          const income = periodTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
          const expense = periodTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
          return {
            date: `Mgg ${w}`,
            income,
            expense,
            net: income - expense
          };
        });
      } else {
        // Show 7 days of selected week (or remaining days if last week)
        const startDay = (Number(selectedWeek) - 1) * 7 + 1;
        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const daysToShow = Math.min(7, daysInMonth - startDay + 1);

        const days = [...Array(daysToShow)].map((_, i) => {
          const d = new Date(selectedYear, selectedMonth, startDay + i);
          return d.toISOString().split('T')[0];
        });

        return days.map(date => {
          const dayTransactions = transactions.filter(t => t.date.startsWith(date));
          const income = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
          const expense = dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
          return {
            date: parseLocalDate(date).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric' }),
            income,
            expense,
            net: income - expense
          };
        });
      }
    }

    if (timeframe === 'monthly') {
      // Show all days of selected month
      const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      const days = [...Array(daysInMonth)].map((_, i) => {
        const d = new Date(selectedYear, selectedMonth, i + 1);
        return d.toISOString().split('T')[0];
      });

      return days.map(date => {
        const dayTransactions = transactions.filter(t => t.date.startsWith(date));
        const income = dayTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = dayTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        return {
          date: new Date(date).getDate().toString(),
          income,
          expense,
          net: income - expense
        };
      });
    }

    if (timeframe === 'yearly') {
      // Show 12 months of selected year
      const months = [...Array(12)].map((_, i) => {
        const d = new Date(selectedYear, i, 1);
        return d.toISOString().slice(0, 7);
      });

      return months.map(month => {
        const periodTransactions = transactions.filter(t => t.date.startsWith(month));
        const income = periodTransactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
        const expense = periodTransactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
        return {
          date: new Date(month + '-01').toLocaleDateString('id-ID', { month: 'short' }),
          income,
          expense,
          net: income - expense
        };
      });
    }
    return [];
  }, [transactions, timeframe, selectedDay, selectedWeek, selectedMonth, selectedYear]);

  // AI Category Suggestion Logic
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (description.length > 3 && type === 'expense' && amount && parseFloat(amount) > 0) {
        setIsSuggesting(true);
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Berikan 2-3 kategori pengeluaran yang paling cocok untuk deskripsi: "${description}" dengan nominal ${formatRupiah(parseFloat(amount))}. Pilih dari daftar ini: ${EXPENSE_CATEGORIES.map(c => c.name).join(', ')}. Berikan jawaban dalam format JSON array string saja, contoh: ["Konsumsi", "Lainnya"]`,
          });
          const text = response.text || "[]";
          const match = text.match(/\[.*\]/);
          if (match) {
            const suggestedNames = JSON.parse(match[0]);
            const suggestions = suggestedNames.map((name: string) => getCategoryByName(name));
            setAiSuggestions(suggestions);
          }
        } catch (e) {
          console.error(e);
        } finally {
          setIsSuggesting(false);
        }
      } else {
        setAiSuggestions([]);
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [description, amount, type]);

  const { totalIncome, totalExpense, balance } = useMemo(() => {
    let income = 0;
    let expense = 0;
    transactions.forEach(t => {
      if (t.type === 'income') income += t.amount;
      if (t.type === 'expense') expense += t.amount;
    });
    return { totalIncome: income, totalExpense: expense, balance: income - expense };
  }, [transactions]);

  const generateInsight = async () => {
    if (isGeneratingInsight) return;
    setIsGeneratingInsight(true);
    const insight = await getAIInsights(transactions, balance);
    setAiInsight(insight);
    setIsGeneratingInsight(false);
  };

  const expenseClusters = useMemo(() => {
    const clusters: Record<string, { amount: number; color: string }> = {};
    transactions.filter(t => t.type === 'expense').forEach(t => {
      const catName = t.category?.name || 'Lainnya';
      if (!clusters[catName]) {
        clusters[catName] = { amount: 0, color: t.category?.color || 'bg-gray-500' };
      }
      clusters[catName].amount += t.amount;
    });
    return Object.entries(clusters)
      .map(([name, data]) => ({
        name,
        amount: data.amount,
        color: data.color,
        percentage: totalExpense > 0 ? (data.amount / totalExpense) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [transactions, totalExpense]);

  // Handlers
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleAddTransaction = async (e?: React.FormEvent, categoryOverride?: string) => {
    if (e) e.preventDefault();
    if (!user || !amount || !description || isAddingTransaction) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert("Masukkan nominal yang valid (lebih dari 0)");
      return;
    }

    setIsAddingTransaction(true);
    let categoryObj = null;
    if (type === 'expense') {
      const catName = categoryOverride || selectedCategory;
      categoryObj = catName === 'Auto' ? categorizeExpense(description) : getCategoryByName(catName);
    }

    const newTransaction = {
      uid: user.uid,
      type,
      amount: parsedAmount,
      description,
      category: categoryObj ? { name: categoryObj.name, color: categoryObj.color } : null,
      date: new Date(transactionDate).toISOString()
    };

    try {
      await addDoc(collection(db, 'transactions'), newTransaction);
      setAmount('');
      setDescription('');
      setSelectedCategory('Auto');
      setAiSuggestions([]);

      // Budget Suggestion Logic
      if (type === 'income' && parsedAmount > 0) {
        const recommended = Math.round(parsedAmount * 0.5); // 50% rule
        setSuggestedBudget(recommended);
        setIsBudgetSuggestionOpen(true);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'transactions');
    } finally {
      setIsAddingTransaction(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'transactions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `transactions/${id}`);
    }
  };

  const handleUpdateBudget = async () => {
    if (!user) return;
    const newBudget = parseFloat(tempBudget);
    if (isNaN(newBudget) || newBudget < 0) return;
    
    const newCategoryBudgets: Record<string, number> = {};
    Object.entries(tempCategoryBudgets).forEach(([cat, val]) => {
      const num = parseFloat(val);
      if (!isNaN(num) && num >= 0) {
        newCategoryBudgets[cat] = num;
      }
    });

    try {
      await setDoc(doc(db, 'users', user.uid), { 
        budget: newBudget,
        categoryBudgets: newCategoryBudgets
      }, { merge: true });
      setBudget(newBudget);
      setCategoryBudgets(newCategoryBudgets);
      setIsBudgetModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    }
  };

  const suggestCategoryBudgets = async () => {
    if (!user || !tempBudget) return;
    setIsSuggestingBudget(true);
    try {
      const total = parseFloat(tempBudget);
      const categories = EXPENSE_CATEGORIES.filter(c => c.name !== 'Lainnya').map(c => c.name).join(', ');
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Saya memiliki total budget bulanan sebesar Rp ${total}. Tolong alokasikan budget ini ke kategori berikut: ${categories}, dan Lainnya. Gunakan prinsip 50/30/20 (50% kebutuhan, 30% keinginan, 20% tabungan/investasi). Berikan output hanya dalam format JSON objek dengan key nama kategori dan value angka nominalnya saja. Contoh: {"Konsumsi": 500000, "Transportasi": 200000, ...}`,
      });
      
      const text = response.text || "{}";
      const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const suggested = JSON.parse(jsonStr);
      
      const newTempCats: Record<string, string> = { ...tempCategoryBudgets };
      Object.entries(suggested).forEach(([cat, val]) => {
        newTempCats[cat] = String(val);
      });
      setTempCategoryBudgets(newTempCats);
    } catch (e) {
      console.error("AI Suggestion Error:", e);
    } finally {
      setIsSuggestingBudget(false);
    }
  };

  const handleUpdateGoalProgress = async (id: string, newCurrent: number) => {
    try {
      await setDoc(doc(db, 'saving_goals', id), { current: newCurrent }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `saving_goals/${id}`);
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !goalName || !goalTarget) {
      alert("Mohon isi nama dan nominal target.");
      return;
    }
    
    const targetVal = parseFloat(goalTarget);
    const currentVal = parseFloat(goalCurrent) || 0;

    if (isNaN(targetVal) || targetVal <= 0) {
      alert("Target nominal harus lebih dari 0.");
      return;
    }
    
    try {
      await addDoc(collection(db, 'saving_goals'), {
        uid: user.uid,
        name: goalName,
        type: goalType,
        target: targetVal,
        current: currentVal,
        createdAt: new Date().toISOString()
      });
      setGoalName('');
      setGoalTarget('');
      setGoalCurrent('');
      setGoalType('Umum');
      setIsGoalModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'saving_goals');
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'saving_goals', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `saving_goals/${id}`);
    }
  };

  const suggestGoalTarget = async () => {
    if (!user || !goalType) return;
    setIsSuggestingGoal(true);
    setAiGoalSuggestion(null);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Berdasarkan uang yang dimiliki user saat ini (${formatRupiah(balance)}), berikan saran nominal target tabungan, jangka waktu (tahun), dan persentase alokasi dari kekayaan saat ini untuk kategori "${goalType}". 
        Berikan jawaban dalam format JSON: {"target": number, "years": number, "percentage": number, "reason": string}. 
        Gunakan bahasa Indonesia untuk "reason".`,
        config: { responseMimeType: "application/json" }
      });
      const data = JSON.parse(response.text || "{}");
      if (data.target) {
        setAiGoalSuggestion(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSuggestingGoal(false);
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center space-y-6"
        >
          <div className="bg-indigo-100 p-4 rounded-full w-fit mx-auto">
            <Wallet className="text-indigo-600" size={40} />
          </div>
          <h1 className="text-3xl font-bold text-slate-800">FinTrack AI</h1>
          <p className="text-slate-600">Kelola keuangan Anda dengan cerdas dan simpan data secara permanen.</p>
          <button 
            onClick={handleLogin}
            className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
          >
            <LogIn size={20} />
            Masuk dengan Google
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-20 md:pb-8 relative overflow-hidden">
      {/* BACKGROUND DECORATIONS */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-200/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-200/20 blur-[120px] rounded-full" />
        <div className="absolute top-[30%] right-[10%] w-[20%] h-[20%] bg-rose-200/10 blur-[80px] rounded-full" />
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 md:py-10 space-y-8 relative z-10">
        
        {/* HEADER */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="sticky top-0 z-40 py-4 -mx-4 px-4 bg-slate-50/80 backdrop-blur-md border-b border-slate-200/50 flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="bg-brand-600 p-3 rounded-2xl text-white shadow-lg shadow-brand-200">
              <Wallet size={28} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-display">FinTrack AI</h1>
              <div className="flex flex-col">
                <p className="text-sm text-slate-500 font-medium">Selamat datang kembali, {user.displayName?.split(' ')[0]} 👋</p>
                <p className="text-xs text-slate-400 font-medium">
                  {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={generateInsight}
              disabled={isGeneratingInsight}
              className="hidden md:flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              <Sparkles size={16} className="text-brand-500" />
              {isGeneratingInsight ? 'Menganalisis...' : 'AI Insights'}
            </button>
            <button 
              onClick={handleLogout}
              className="p-3 bg-white border border-slate-200 rounded-xl text-slate-400 hover:text-rose-500 transition-all shadow-sm"
              title="Keluar"
            >
              <LogOut size={20} />
            </button>
          </div>
        </motion.header>

        {/* WELCOME BANNER */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-brand-600 to-indigo-800 p-8 md:p-12 text-white shadow-2xl shadow-brand-200"
        >
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 backdrop-blur-md rounded-full text-xs font-bold uppercase tracking-widest border border-white/10">
                <Sparkles size={12} className="text-brand-300" />
                <span>Financial Overview</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold font-display tracking-tight leading-tight">
                Kelola Keuangan <br />
                <span className="text-brand-300">Lebih Cerdas.</span>
              </h2>
              <p className="text-brand-100/80 max-w-md font-medium">
                Gunakan asisten AI untuk menganalisis pengeluaran Anda dan dapatkan saran praktis untuk menabung lebih banyak.
              </p>
            </div>
            
            <div className="flex flex-col items-end gap-2">
              <p className="text-sm font-bold text-brand-200 uppercase tracking-widest">Total Saldo Anda</p>
              <h3 className="text-4xl md:text-5xl font-bold font-display tracking-tighter">{formatRupiah(balance)}</h3>
              <div className="flex items-center gap-3 mt-4">
                <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-center">
                  <p className="text-[10px] font-bold text-brand-300 uppercase">Pemasukan</p>
                  <p className="font-bold text-sm">{formatRupiah(totalIncome)}</p>
                </div>
                <div className="px-4 py-2 bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 text-center">
                  <p className="text-[10px] font-bold text-rose-300 uppercase">Pengeluaran</p>
                  <p className="font-bold text-sm">{formatRupiah(totalExpense)}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* DECORATIVE SHAPES */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-400/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl" />
        </motion.div>

        {/* ACTIVITY TABS (ABOVE CHART) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          <button 
            onClick={() => setChartTab('all')}
            className={cn(
              "flex items-center gap-3 p-4 rounded-2xl border transition-all group",
              chartTab === 'all' ? "bg-brand-50 border-brand-200 shadow-md" : "bg-white border-slate-100 shadow-sm hover:shadow-md"
            )}
          >
            <div className={cn(
              "p-2 rounded-xl transition-transform group-hover:scale-110",
              chartTab === 'all' ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-600"
            )}>
              <Wallet size={20} />
            </div>
            <span className="font-bold text-sm text-slate-700">Semua</span>
          </button>
          <button 
            onClick={() => setChartTab('expense')}
            className={cn(
              "flex items-center gap-3 p-4 rounded-2xl border transition-all group",
              chartTab === 'expense' ? "bg-rose-50 border-rose-200 shadow-md" : "bg-white border-slate-100 shadow-sm hover:shadow-md"
            )}
          >
            <div className={cn(
              "p-2 rounded-xl transition-transform group-hover:scale-110",
              chartTab === 'expense' ? "bg-rose-500 text-white" : "bg-rose-50 text-rose-600"
            )}>
              <TrendingDown size={20} />
            </div>
            <span className="font-bold text-sm text-slate-700">Keluar</span>
          </button>
          <button 
            onClick={() => setChartTab('income')}
            className={cn(
              "flex items-center gap-3 p-4 rounded-2xl border transition-all group",
              chartTab === 'income' ? "bg-emerald-50 border-emerald-200 shadow-md" : "bg-white border-slate-100 shadow-sm hover:shadow-md"
            )}
          >
            <div className={cn(
              "p-2 rounded-xl transition-transform group-hover:scale-110",
              chartTab === 'income' ? "bg-emerald-500 text-white" : "bg-emerald-50 text-emerald-600"
            )}>
              <TrendingUp size={20} />
            </div>
            <span className="font-bold text-sm text-slate-700">Masuk</span>
          </button>
          <button 
            onClick={generateInsight}
            disabled={isGeneratingInsight}
            className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group disabled:opacity-50"
          >
            <div className="p-2 bg-brand-50 text-brand-600 rounded-xl group-hover:scale-110 transition-transform">
              <Sparkles size={20} className={cn(isGeneratingInsight && "animate-pulse")} />
            </div>
            <span className="font-bold text-sm text-slate-700">AI Insight</span>
          </button>
          <button 
            onClick={() => setIsBudgetModalOpen(true)}
            className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl group-hover:scale-110 transition-transform">
              <Target size={20} />
            </div>
            <span className="font-bold text-sm text-slate-700">Set Budget</span>
          </button>
        </div>

        {/* MAIN CONTENT BENTO */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* LEFT COLUMN: INPUT & CHART */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* CHART CARD */}
            <Card 
              title="Aktivitas" 
              icon={TrendingUp}
              extra={
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {(['daily', 'weekly', 'monthly', 'yearly'] as const).map((tf) => (
                    <button 
                      key={tf}
                      onClick={() => setTimeframe(tf)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all capitalize",
                        timeframe === tf ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      )}
                    >
                      {tf === 'daily' ? 'Harian' : tf === 'weekly' ? 'Mingguan' : tf === 'monthly' ? 'Bulanan' : 'Tahunan'}
                    </button>
                  ))}
                </div>
              }
            >
              <div className="space-y-6">
                {/* DETAILED SELECTORS */}
                <div className="flex flex-col gap-4">
                  {timeframe === 'daily' && (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {[...Array(new Date(selectedYear, selectedMonth + 1, 0).getDate())].map((_, i) => {
                        const day = i + 1;
                        const d = new Date(selectedYear, selectedMonth, day);
                        const isToday = new Date().toDateString() === d.toDateString();
                        const isSelected = selectedDay === day;
                        return (
                          <button
                            key={day}
                            onClick={() => setSelectedDay(day)}
                            className={cn(
                              "flex flex-col items-center min-w-[56px] py-4 rounded-3xl border transition-all relative",
                              isSelected 
                                ? "bg-brand-600 border-brand-600 text-white shadow-xl shadow-brand-200 scale-105 z-10" 
                                : "bg-white border-slate-100 text-slate-500 hover:border-brand-200",
                              isToday && !isSelected && "ring-2 ring-brand-100"
                            )}
                          >
                            <span className="text-[10px] font-bold uppercase opacity-60 mb-1">
                              {d.toLocaleDateString('id-ID', { weekday: 'short' })}
                            </span>
                            <span className="text-lg font-bold leading-none">{day}</span>
                            {isToday && (
                              <div className={cn(
                                "absolute -bottom-1 w-1.5 h-1.5 rounded-full",
                                isSelected ? "bg-white" : "bg-brand-600"
                              )} />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {timeframe === 'weekly' && (
                    <div className="flex bg-slate-50 p-1 rounded-xl border border-slate-100 w-fit overflow-x-auto">
                      {(() => {
                        const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
                        const numWeeks = Math.ceil(daysInMonth / 7);
                        return (['all', ...Array.from({ length: numWeeks }, (_, i) => i + 1)] as const).map((w) => (
                          <button
                            key={w}
                            onClick={() => setSelectedWeek(w as any)}
                            className={cn(
                              "px-4 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap",
                              selectedWeek === w ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                            )}
                          >
                            {w === 'all' ? 'Semua Minggu' : `Minggu ${w}`}
                          </button>
                        ));
                      })()}
                    </div>
                  )}

                  {timeframe === 'monthly' && (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-2">
                      {[...Array(12)].map((_, i) => {
                        const isSelected = selectedMonth === i;
                        return (
                          <button
                            key={i}
                            onClick={() => setSelectedMonth(i)}
                            className={cn(
                              "py-2 rounded-xl border text-[10px] font-bold transition-all",
                              isSelected ? "bg-brand-600 border-brand-600 text-white shadow-md" : "bg-white border-slate-100 text-slate-500 hover:border-brand-200"
                            )}
                          >
                            {new Date(0, i).toLocaleDateString('id-ID', { month: 'short' })}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {timeframe === 'yearly' && (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                      {availableYears.map((year) => {
                        const isSelected = selectedYear === year;
                        return (
                          <button
                            key={year}
                            onClick={() => setSelectedYear(year)}
                            className={cn(
                              "px-4 py-2 rounded-xl border text-xs font-bold transition-all min-w-[80px]",
                              isSelected ? "bg-brand-600 border-brand-600 text-white shadow-md" : "bg-white border-slate-100 text-slate-500 hover:border-brand-200"
                            )}
                          >
                            {year}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3355ff" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#3355ff" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} dy={10} />
                    <YAxis hide />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ fontSize: '12px', fontWeight: '600' }}
                    />
                    {chartTab === 'all' && (
                      <>
                        <Area type="monotone" dataKey="income" name="Pemasukan" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={3} />
                        <Area type="monotone" dataKey="expense" name="Pengeluaran" stroke="#f43f5e" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={3} />
                      </>
                    )}
                    {chartTab === 'income' && <Area type="monotone" dataKey="income" name="Pemasukan" stroke="#10b981" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={3} />}
                    {chartTab === 'expense' && <Area type="monotone" dataKey="expense" name="Pengeluaran" stroke="#f43f5e" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={3} />}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Card>

            {/* AI INSIGHTS MOBILE */}
            <AnimatePresence>
              {aiInsight && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <Card title="AI Financial Insights" icon={Sparkles} className="bg-brand-50 border-brand-100">
                    <div className="markdown-body">
                      <Markdown>{aiInsight}</Markdown>
                    </div>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {/* INPUT FORM */}
            <Card title="Catat Transaksi Baru" icon={PlusCircle}>
              <form onSubmit={handleAddTransaction} className="space-y-6">
                <div className="flex p-1.5 bg-slate-100 rounded-2xl w-full max-w-md mx-auto">
                  <button
                    type="button"
                    onClick={() => setType('expense')}
                    className={cn(
                      "flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300",
                      type === 'expense' ? "bg-white text-rose-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Pengeluaran
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('income')}
                    className={cn(
                      "flex-1 py-3 text-sm font-bold rounded-xl transition-all duration-300",
                      type === 'income' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Pemasukan
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Nominal</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">Rp</span>
                      <input
                        type="number"
                        placeholder="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-display text-lg font-semibold"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Deskripsi</label>
                    <input
                      type="text"
                      placeholder="E.g. Makan Siang"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Tanggal</label>
                    <input
                      type="date"
                      value={transactionDate}
                      onChange={(e) => setTransactionDate(e.target.value)}
                      className="w-full px-4 py-4 rounded-2xl border border-slate-200 focus:ring-4 focus:ring-brand-500/10 focus:border-brand-500 outline-none transition-all font-medium bg-white"
                      required
                    />
                  </div>
                </div>

                {type === 'expense' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-1">Kategori</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {EXPENSE_CATEGORIES.map(cat => (
                          <button
                            key={cat.name}
                            type="button"
                            onClick={() => setSelectedCategory(cat.name)}
                            className={cn(
                              "py-3 px-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-2",
                              selectedCategory === cat.name ? "bg-brand-50 border-brand-500 text-brand-600" : "bg-white border-slate-200 text-slate-500 hover:border-brand-200"
                            )}
                          >
                            <cat.icon size={16} />
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* AI SUGGESTIONS BALLOON */}
                    <AnimatePresence>
                      {aiSuggestions.length > 0 && selectedCategory === 'Auto' && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.95 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 10, scale: 0.95 }}
                          className="relative p-5 bg-indigo-600 text-white rounded-[2rem] shadow-xl shadow-indigo-200 border-none z-10"
                        >
                          <div className="absolute -top-2 left-8 w-4 h-4 bg-indigo-600 rotate-45" />
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles size={14} className="text-amber-300 animate-pulse" />
                            <p className="text-[10px] font-bold uppercase tracking-widest">AI Menganalisis Kategori...</p>
                          </div>
                          <p className="text-xs mb-4 opacity-90">Berdasarkan deskripsi Anda, ini kategori yang paling cocok:</p>
                          <div className="flex flex-wrap gap-2">
                            {aiSuggestions.map(suggestion => (
                              <button
                                key={suggestion.name}
                                type="button"
                                disabled={isAddingTransaction}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAddTransaction(undefined, suggestion.name);
                                }}
                                className={cn(
                                  "px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                                  isAddingTransaction ? "opacity-50 cursor-not-allowed" : "hover:bg-white/30 active:scale-95",
                                  selectedCategory === suggestion.name ? "bg-white text-indigo-600" : "bg-white/20 text-white"
                                )}
                              >
                                {suggestion.name}
                              </button>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <div className="flex gap-3">
                  {type === 'expense' && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('Auto');
                      }}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-5 rounded-2xl border-2 transition-all font-bold text-sm",
                        selectedCategory === 'Auto' 
                          ? "bg-indigo-50 border-indigo-500 text-indigo-600 shadow-lg shadow-indigo-100" 
                          : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200"
                      )}
                    >
                      <Sparkles size={20} className={cn(isSuggesting && "animate-spin")} />
                      {isSuggesting ? "Analisis..." : "Auto AI"}
                    </button>
                  )}
                  <button
                    type="submit"
                    className={cn(
                      "flex-[2] py-5 rounded-2xl font-bold text-white text-lg shadow-lg transition-all active:scale-[0.98]",
                      type === 'expense' ? "bg-rose-500 hover:bg-rose-600 shadow-rose-100" : "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-100"
                    )}
                  >
                    Simpan Transaksi
                  </button>
                </div>
              </form>
            </Card>

            {/* TRANSACTION LIST */}
            <Card title="Riwayat Transaksi" icon={Calendar}>
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text"
                    placeholder="Cari transaksi..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-brand-500/20 outline-none text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-500 outline-none hover:bg-slate-50 transition-all"
                  >
                    <option value="all">Semua Kategori</option>
                    {EXPENSE_CATEGORIES.map(cat => (
                      <option key={cat.name} value={cat.name}>{cat.name}</option>
                    ))}
                    <option value="Pemasukan">Pemasukan</option>
                  </select>
                  {(['all', 'income', 'expense'] as const).map(t => (
                    <button
                      key={t}
                      onClick={() => setFilterType(t)}
                      className={cn(
                        "px-4 py-2 rounded-xl text-xs font-bold border transition-all capitalize",
                        filterType === t ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {t === 'all' ? 'Semua' : t === 'income' ? 'Masuk' : 'Keluar'}
                    </button>
                  ))}
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-600"></div>
                </div>
              ) : groupedTransactions.length === 0 ? (
                <div className="text-center py-16 space-y-3">
                  <div className="bg-slate-100 p-4 rounded-full w-fit mx-auto">
                    <Search size={32} className="text-slate-300" />
                  </div>
                  <p className="text-slate-400 font-medium">Tidak ada transaksi ditemukan.</p>
                </div>
              ) : (
                <div className="space-y-8">
                  <AnimatePresence mode="popLayout">
                    {groupedTransactions.map(([date, items]) => (
                      <div key={date} className="space-y-3">
                        <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-1">{date}</h4>
                        <div className="space-y-3">
                          {items.map(t => (
                            <motion.div 
                              key={t.id}
                              layout
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className="group flex items-center justify-between p-4 rounded-2xl border border-slate-50 bg-white hover:bg-slate-50/80 hover:border-slate-100 transition-all shadow-sm hover:shadow-md"
                            >
                              <div className="flex items-center gap-4">
                                <div className={cn(
                                  "p-3 rounded-xl",
                                  t.type === 'income' ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                                )}>
                                  {t.type === 'income' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                                </div>
                                <div>
                                  <p className="font-bold text-slate-800 leading-tight text-sm">{t.description}</p>
                                  <div className="flex items-center gap-3 mt-1">
                                    {t.category && (
                                      <span className={cn(
                                        "text-[9px] px-2 py-0.5 rounded-md text-white font-bold uppercase tracking-wider",
                                        t.category.color
                                      )}>
                                        {t.category.name}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className={cn(
                                  "font-display font-bold text-base",
                                  t.type === 'income' ? "text-emerald-600" : "text-slate-900"
                                )}>
                                  {t.type === 'income' ? '+' : '-'}{formatRupiah(t.amount)}
                                </span>
                                <button 
                                  onClick={() => handleDelete(t.id)} 
                                  className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </Card>
          </div>

          {/* RIGHT COLUMN: BUDGET & CATEGORIES */}
          <div className="lg:col-span-4 space-y-8">
            
            {/* BUDGET CARD */}
            <Card title="Budget Bulanan" icon={Target}>
              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Terpakai</p>
                    <h4 className="text-2xl font-bold font-display">{formatRupiah(totalExpense)}</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Limit</p>
                    <p className="font-bold text-slate-600">{formatRupiah(budget)}</p>
                  </div>
                </div>
                
                <div className="relative h-4 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((totalExpense / budget) * 100, 100)}%` }}
                    className={cn(
                      "h-full rounded-full transition-all duration-1000",
                      (totalExpense / budget) > 0.9 ? "bg-rose-500" : (totalExpense / budget) > 0.7 ? "bg-amber-500" : "bg-brand-500"
                    )}
                  />
                </div>
                
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">
                    {(totalExpense / budget) > 1 
                      ? "⚠️ Waduh! Pengeluaran Anda sudah melebihi budget. Waktunya berhemat!" 
                      : `Sisa budget Anda adalah ${formatRupiah(budget - totalExpense)}. Gunakan dengan bijak!`}
                  </p>
                </div>
              </div>
            </Card>

            {/* CATEGORY DISTRIBUTION */}
            <Card title="Distribusi Kategori" icon={PieChartIcon}>
              {expenseClusters.length === 0 ? (
                <div className="text-center py-12">
                  <PieChartIcon size={40} className="text-slate-100 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 font-medium">Belum ada data pengeluaran.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={expenseClusters}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="amount"
                        >
                          {expenseClusters.map((entry, index) => {
                            const cat = EXPENSE_CATEGORIES.find(c => c.name === entry.name);
                            return <Cell key={`cell-${index}`} fill={cat?.hex || '#6b7280'} />;
                          })}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                          formatter={(value: number) => formatRupiah(value)}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-4">
                    {expenseClusters.map((cluster) => (
                      <div key={cluster.name} className="group">
                        <div className="flex justify-between text-sm mb-2 font-bold text-slate-700">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-full", cluster.color)} />
                            <span>{cluster.name}</span>
                          </div>
                          <span>{Math.round(cluster.percentage)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${cluster.percentage}%` }}
                            className={cn("h-full rounded-full", cluster.color)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            {/* SAVING GOAL */}
            {/* BUDGET PROGRESS PER CATEGORY */}
            {Object.keys(categoryBudgets).length > 0 && (
              <Card title="Budget per Kategori" icon={Target}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {EXPENSE_CATEGORIES.filter(cat => categoryBudgets[cat.name]).map(cat => {
                    const spent = transactions
                      .filter(t => t.type === 'expense' && t.category?.name === cat.name)
                      .reduce((acc, curr) => acc + curr.amount, 0);
                    const limit = categoryBudgets[cat.name];
                    const percent = Math.min((spent / limit) * 100, 100);
                    const isOver = spent > limit;

                    return (
                      <div key={cat.name} className="space-y-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <div className={cn("w-2 h-2 rounded-full", cat.color.split(' ')[0].replace('bg-', 'bg-'))} style={{ backgroundColor: cat.color.includes('#') ? cat.color : undefined }} />
                            <span className="text-xs font-bold text-slate-700">{cat.name}</span>
                          </div>
                          <span className={cn("text-[10px] font-bold", isOver ? "text-rose-600" : "text-slate-400")}>
                            {formatRupiah(spent)} / {formatRupiah(limit)}
                          </span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percent}%` }}
                            className={cn(
                              "h-full rounded-full transition-all",
                              isOver ? "bg-rose-500" : "bg-brand-500"
                            )}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            <Card title="Target Tabungan" icon={Target}>
              <div className="space-y-6">
                {savingGoals.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">Belum ada target tabungan.</p>
                ) : (
                  savingGoals.map(goal => {
                    const progress = Math.min((goal.current / goal.target) * 100, 100);
                    return (
                      <div key={goal.id} className="space-y-2 group relative">
                        <div className="flex justify-between items-center">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700">{goal.name}</span>
                            {goal.type && <span className="text-[10px] font-bold text-brand-500 uppercase tracking-widest">{goal.type}</span>}
                          </div>
                          <span className="text-xs font-bold text-brand-600">{Math.round(progress)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className="bg-brand-500 h-full rounded-full" 
                          />
                        </div>
                        <div className="flex justify-between text-[10px] font-bold text-slate-400">
                          <div className="flex items-center gap-1">
                            <span>{formatRupiah(goal.current)}</span>
                            <button 
                              onClick={() => {
                                const val = prompt("Masukkan jumlah tabungan baru:", goal.current.toString());
                                if (val !== null) {
                                  const num = parseFloat(val);
                                  if (!isNaN(num)) handleUpdateGoalProgress(goal.id, num);
                                }
                              }}
                              className="text-brand-600 hover:text-brand-700"
                            >
                              <PlusCircle size={10} />
                            </button>
                          </div>
                          <span>{formatRupiah(goal.target)}</span>
                        </div>
                        <button 
                          onClick={() => handleDeleteGoal(goal.id)}
                          className="absolute -right-2 -top-2 p-1 bg-rose-50 text-rose-500 rounded-full opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })
                )}
                <button 
                  onClick={() => setIsGoalModalOpen(true)}
                  className="w-full py-3 border-2 border-dashed border-slate-200 rounded-2xl text-slate-400 text-xs font-bold hover:border-brand-300 hover:text-brand-500 transition-all flex items-center justify-center gap-2"
                >
                  <PlusCircle size={14} />
                  Tambah Target
                </button>
              </div>
            </Card>

            {/* QUICK TIPS */}
            <Card title="Tips Keuangan" icon={Sparkles} className="bg-slate-900 text-white border-none">
              <div className="space-y-6">
                <div className="p-4 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-sm text-slate-200 leading-relaxed italic">
                    "{FINANCIAL_TIPS[activeTipIndex]}"
                  </p>
                </div>
                <button 
                  onClick={() => setIsTipsModalOpen(true)}
                  className="w-full py-2 text-[10px] font-bold text-brand-400 uppercase tracking-widest hover:text-brand-300 transition-all"
                >
                  Lihat Tips Lainnya
                </button>
              </div>
            </Card>

          </div>
        </div>
      </div>
      
      {/* MOBILE NAV BAR */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-lg border-t border-slate-200 px-6 py-3 flex justify-around items-center z-50">
        <button className="p-2 text-brand-600"><Home size={24} /></button>
        <button className="p-3 bg-brand-600 text-white rounded-2xl -mt-10 shadow-lg shadow-brand-200"><PlusCircle size={28} /></button>
        <button className="p-2 text-slate-400" onClick={generateInsight}><Sparkles size={24} /></button>
      </div>

      {/* MODALS */}
      <AnimatePresence>
        {isBudgetModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsBudgetModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold font-display">Atur Budget Bulanan</h3>
                <button 
                  onClick={suggestCategoryBudgets}
                  disabled={isSuggestingBudget}
                  className="px-4 py-2 bg-brand-50 text-brand-600 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-brand-100 transition-all disabled:opacity-50"
                >
                  <Sparkles size={14} className={isSuggestingBudget ? "animate-spin" : ""} />
                  {isSuggestingBudget ? "Menganalisis..." : "AI Smart Suggest"}
                </button>
              </div>

              <div className="space-y-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Total Budget (Rp)</label>
                  <input 
                    type="number"
                    value={tempBudget}
                    onChange={(e) => setTempBudget(e.target.value)}
                    className="w-full bg-transparent border-none outline-none font-bold text-2xl text-slate-900 p-0"
                    placeholder="0"
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-slate-900">Alokasi Kategori</h4>
                    <span className={cn(
                      "text-[10px] font-bold px-2 py-1 rounded-lg",
                      (Object.values(tempCategoryBudgets).reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0) > (parseFloat(tempBudget) || 0)) 
                        ? "bg-red-50 text-red-600" 
                        : "bg-green-50 text-green-600"
                    )}>
                      Terpakai: Rp {Object.values(tempCategoryBudgets).reduce((acc, curr) => acc + (parseFloat(curr) || 0), 0).toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {EXPENSE_CATEGORIES.map(cat => (
                      <div key={cat.name} className="p-3 bg-white border border-slate-100 rounded-xl hover:border-brand-200 transition-all">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={cn("w-2 h-2 rounded-full", cat.color.split(' ')[0].replace('bg-', 'bg-'))} style={{ backgroundColor: cat.color.includes('#') ? cat.color : undefined }} />
                          <span className="text-xs font-bold text-slate-600">{cat.name}</span>
                        </div>
                        <input 
                          type="number"
                          placeholder="0"
                          value={tempCategoryBudgets[cat.name] || ''}
                          onChange={(e) => setTempCategoryBudgets({ ...tempCategoryBudgets, [cat.name]: e.target.value })}
                          className="w-full text-sm font-bold outline-none bg-transparent"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handleUpdateBudget}
                  className="w-full py-4 bg-brand-600 text-white rounded-2xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-700 transition-all mt-4"
                >
                  Simpan Perubahan
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isGoalModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsGoalModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-xl font-bold mb-6 font-display">Tambah Target Tabungan</h3>
              
              {/* AI SUGGESTION SECTION - FIRST */}
              <div className="mb-6 p-4 bg-brand-50 rounded-2xl border border-brand-100">
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-brand-600" />
                    <span className="text-xs font-bold text-brand-700">AI Suggestion</span>
                  </div>
                  <button 
                    type="button"
                    onClick={suggestGoalTarget}
                    disabled={isSuggestingGoal}
                    className="text-[10px] font-bold text-brand-600 hover:underline disabled:opacity-50"
                  >
                    {isSuggestingGoal ? "Menganalisis..." : "Dapatkan Saran"}
                  </button>
                </div>
                
                {aiGoalSuggestion ? (
                  <div className="space-y-3">
                    <p className="text-[10px] text-slate-600 leading-relaxed italic">"{aiGoalSuggestion.reason}"</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-white p-2 rounded-lg border border-brand-100 text-center">
                        <p className="text-[8px] text-slate-400 uppercase">Target</p>
                        <p className="text-[10px] font-bold text-brand-600">Rp {aiGoalSuggestion.target.toLocaleString()}</p>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-brand-100 text-center">
                        <p className="text-[8px] text-slate-400 uppercase">Waktu</p>
                        <p className="text-[10px] font-bold text-brand-600">{aiGoalSuggestion.years} Thn</p>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-brand-100 text-center">
                        <p className="text-[8px] text-slate-400 uppercase">Alokasi</p>
                        <p className="text-[10px] font-bold text-brand-600">{aiGoalSuggestion.percentage}%</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setGoalTarget(aiGoalSuggestion.target.toString());
                        setGoalYears(aiGoalSuggestion.years.toString());
                        setGoalPercentage(aiGoalSuggestion.percentage.toString());
                      }}
                      className="w-full py-2 bg-brand-600 text-white rounded-xl text-[10px] font-bold hover:bg-brand-700 transition-all"
                    >
                      Terapkan Saran
                    </button>
                  </div>
                ) : (
                  <p className="text-[10px] text-slate-400 text-center py-2">Klik tombol untuk mendapatkan saran keuangan cerdas.</p>
                )}
              </div>

              <form onSubmit={handleAddGoal} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tipe Target</label>
                  <div className="flex flex-wrap gap-2">
                    {GOAL_PRESETS.map(preset => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setGoalType(preset);
                          if (goalName === '') setGoalName(preset);
                        }}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all",
                          goalType === preset ? "bg-brand-500 text-white border-brand-500" : "bg-white text-slate-500 border-slate-200"
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nama Target</label>
                  <input 
                    type="text"
                    placeholder="E.g. Dana Darurat"
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-medium"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Jangka Waktu (Tahun)</label>
                    <select 
                      value={goalYears}
                      onChange={(e) => setGoalYears(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-medium bg-white"
                    >
                      {[1, 2, 3, 5, 10, 20].map(y => <option key={y} value={y}>{y} Tahun</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Alokasi (% Saldo)</label>
                    <select 
                      value={goalPercentage}
                      onChange={(e) => setGoalPercentage(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-medium bg-white"
                    >
                      {[5, 10, 20, 30, 50].map(p => <option key={p} value={p}>{p}%</option>)}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nominal Target (Rp)</label>
                  <input 
                    type="number"
                    placeholder="0"
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sudah Terkumpul (Rp)</label>
                  <input 
                    type="number"
                    placeholder="0"
                    value={goalCurrent}
                    onChange={(e) => setGoalCurrent(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none font-bold"
                  />
                </div>
                <button 
                  type="submit"
                  className="w-full py-4 bg-brand-600 text-white rounded-2xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-700 transition-all mt-4"
                >
                  Tambah Target
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {isTipsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsTipsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-brand-50">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-brand-500 text-white rounded-2xl shadow-lg shadow-brand-200">
                    <Lightbulb size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 font-display">Kumpulan Tips Keuangan</h2>
                    <p className="text-sm text-slate-500 font-medium">Inspirasi harian untuk masa depan cerah</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsTipsModalOpen(false)}
                  className="p-2 hover:bg-white rounded-full transition-colors"
                >
                  <X size={24} className="text-slate-400" />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-8 space-y-4">
                {FINANCIAL_TIPS.map((tip, index) => ({ tip, index }))
                  .sort((a, b) => b.index - a.index)
                  .map(({ tip, index }) => {
                    const isToday = index === activeTipIndex;
                    return (
                      <div 
                        key={index}
                        className={cn(
                          "p-6 rounded-3xl border transition-all",
                          isToday 
                            ? "bg-brand-50 border-brand-200 shadow-md ring-2 ring-brand-500/20" 
                            : "bg-white border-slate-100 hover:border-slate-200"
                        )}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-widest",
                            isToday ? "text-brand-600" : "text-slate-400"
                          )}>
                            {getTipDate(index)}
                          </span>
                          {isToday && (
                            <span className="px-2 py-0.5 bg-brand-500 text-white text-[9px] font-bold rounded-full uppercase">
                              Hari Ini
                            </span>
                          )}
                        </div>
                        <p className={cn(
                          "text-sm leading-relaxed",
                          isToday ? "text-slate-800 font-bold" : "text-slate-600 font-medium"
                        )}>
                          {tip}
                        </p>
                      </div>
                    );
                  })}
              </div>
              <div className="p-6 border-t border-slate-100 bg-white">
                <button 
                  onClick={() => setIsTipsModalOpen(false)}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold shadow-lg shadow-slate-200 hover:bg-slate-800 transition-all active:scale-95"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isBudgetSuggestionOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsBudgetSuggestionOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[2rem] p-8 w-full max-w-sm shadow-2xl text-center"
            >
              <div className="bg-emerald-100 p-4 rounded-full w-fit mx-auto mb-6">
                <TrendingUp className="text-emerald-600" size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2 font-display">Pemasukan Terdeteksi!</h3>
              <p className="text-sm text-slate-600 mb-6">
                Anda baru saja menerima pemasukan. AI merekomendasikan untuk memperbarui budget bulanan Anda menjadi:
              </p>
              <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8">
                <p className="text-2xl font-bold text-brand-600">{formatRupiah(suggestedBudget)}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">(50% dari Pemasukan)</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setIsBudgetSuggestionOpen(false)}
                  className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                >
                  Nanti Saja
                </button>
                <button 
                  onClick={async () => {
                    if (!user) return;
                    await setDoc(doc(db, 'users', user.uid), { budget: suggestedBudget }, { merge: true });
                    setBudget(suggestedBudget);
                    setTempBudget(suggestedBudget.toString());
                    setIsBudgetSuggestionOpen(false);
                  }}
                  className="py-4 bg-brand-600 text-white rounded-2xl font-bold shadow-lg shadow-brand-200 hover:bg-brand-700 transition-all"
                >
                  Terapkan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <FinTrackApp />
    </ErrorBoundary>
  );
}
