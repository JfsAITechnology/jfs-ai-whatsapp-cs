import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabaseConfigured } from './lib/supabase';
import './styles.css';

const initialProducts = [
  { id: 1, name: 'Contoh Produk UMKM', price: 75000, stock: 12, description: 'Produk contoh untuk mencoba AI Customer Service.' },
  { id: 2, name: 'Paket Layanan Premium', price: 150000, stock: 8, description: 'Contoh layanan premium untuk demo.' }
];

const initialFaq = [
  { id: 1, q: 'Jam buka?', a: 'Senin–Sabtu, 08.00–20.00.' },
  { id: 2, q: 'Cara pesan?', a: 'Sebutkan produk dan jumlah yang ingin dipesan. Admin akan membantu proses berikutnya.' },
  { id: 3, q: 'Lokasi?', a: 'Silakan cek alamat usaha pada profil bisnis.' }
];

const initialAutomations = [
  { id: 1, name: 'Konfirmasi Pesanan', trigger: 'Order dibuat', action: 'Kirim pesan konfirmasi', active: true },
  { id: 2, name: 'Pengingat Pelanggan', trigger: 'Jadwal mendekat', action: 'Kirim reminder WhatsApp', active: true },
  { id: 3, name: 'Follow-up Setelah Transaksi', trigger: 'Order selesai + 3 hari', action: 'Kirim pesan follow-up', active: false }
];

function App() {
  const [tab, setTab] = useState('home');
  const [business, setBusiness] = useState({ name: 'Usaha Saya', description: 'Usaha UMKM Anda', hours: 'Senin–Sabtu, 08.00–20.00', location: 'Alamat usaha Anda' });
  const [products, setProducts] = useState(initialProducts);
  const [faq, setFaq] = useState(initialFaq);
  const [automations, setAutomations] = useState(initialAutomations);
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState([{ role: 'ai', text: 'Halo 👋 Saya AI Customer Service. Tanyakan tentang produk, layanan, jam buka, lokasi, atau cara pemesanan.' }]);
  const [waConnected, setWaConnected] = useState(false);
  const [waNumber, setWaNumber] = useState('');
  const [notice, setNotice] = useState('');

  const answer = useMemo(() => {
    const q = question.trim().toLowerCase();
    if (!q) return '';
    const product = products.find(p => q.includes(p.name.toLowerCase()));
    if (product) return `${product.name}: Rp${product.price.toLocaleString('id-ID')}. Stok: ${product.stock} unit. ${product.description}`;
    if (q.includes('harga') || q.includes('produk')) return `Saat ini tersedia ${products.length} produk. Silakan tanyakan nama produk yang ingin diketahui.`;
    if (q.includes('jam') || q.includes('buka')) return business.hours;
    if (q.includes('lokasi') || q.includes('alamat')) return business.location;
    const f = faq.find(x => q.includes(x.q.replace('?', '').toLowerCase()));
    if (f) return f.a;
    if (q.includes('pesan') || q.includes('order') || q.includes('beli')) return 'Baik. Sebutkan nama produk dan jumlah yang ingin dipesan. Sistem dapat dikembangkan untuk meneruskan order ke JFS AI Platform.';
    return 'Maaf, saya belum memiliki informasi tersebut. Silakan hubungi admin untuk mendapatkan bantuan lebih lanjut.';
  }, [question, products, faq, business]);

  function send() {
    if (!question.trim()) return;
    setMessages(m => [...m, { role: 'user', text: question }, { role: 'ai', text: answer }]);
    setQuestion('');
  }

  function toggleAutomation(id) {
    setAutomations(items => items.map(a => a.id === id ? { ...a, active: !a.active } : a));
  }

  function addAutomation() {
    setAutomations(items => [...items, { id: Date.now(), name: 'Automation Baru', trigger: 'Kondisi bisnis', action: 'Kirim WhatsApp', active: false }]);
  }

  function connectWhatsApp() {
    if (!waNumber.trim()) {
      setNotice('Masukkan nomor WhatsApp Business terlebih dahulu.');
      return;
    }
    setWaConnected(true);
    setNotice('Nomor tersimpan sebagai konfigurasi demo. Koneksi WhatsApp Cloud API membutuhkan kredensial backend pada tahap integrasi.');
  }

  const activeAutomationCount = automations.filter(a => a.active).length;

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setTab('home')}>
          <span className="brand-mark">✦</span>
          <span><b>JFS AI</b><small>WHATSAPP BUSINESS AI</small></span>
        </button>
        <div className="top-status"><span className="dot" /> {supabaseConfigured ? 'Supabase siap' : 'MVP / Demo'}</div>
      </header>

      <main className="shell">
        {tab === 'home' && <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow">JFS AI PLATFORM • MODUL WHATSAPP</span>
            <h1>WhatsApp yang membantu bisnis <em>bekerja lebih pintar.</em></h1>
            <p>Gunakan AI Customer Service untuk menjawab pelanggan dan WhatsApp AI Automation untuk menjalankan komunikasi bisnis secara otomatis.</p>
            <div className="hero-actions">
              <button className="primary" onClick={() => setTab('cs')}>Buka AI Customer Service →</button>
              <button className="secondary" onClick={() => setTab('automation')}>Buka WA Automation →</button>
            </div>
            <div className="feature-pills"><span>✓ Jawab pertanyaan</span><span>✓ Informasi bisnis</span><span>✓ Order & follow-up</span></div>
          </div>
          <div className="overview-card">
            <div className="card-title"><div><b>JFS AI WhatsApp</b><small>Ringkasan modul</small></div><span className="online">● Online</span></div>
            <div className="metric-grid">
              <div><small>Produk</small><strong>{products.length}</strong></div>
              <div><small>FAQ</small><strong>{faq.length}</strong></div>
              <div><small>Automation aktif</small><strong>{activeAutomationCount}</strong></div>
              <div><small>WhatsApp</small><strong>{waConnected ? 'ON' : 'OFF'}</strong></div>
            </div>
            <div className="flow"><span>Customer</span><i>→</i><span>AI CS</span><i>→</i><span>Automation</span><i>→</i><span>WhatsApp</span></div>
          </div>
        </section>}

        {tab === 'cs' && <section className="page">
          <div className="page-head"><div><span className="eyebrow">KATALOG #2</span><h2>AI Customer Service</h2><p>Pelanggan bisa mendapat jawaban dengan cepat.</p></div><button className="secondary" onClick={() => setTab('home')}>← Dashboard</button></div>
          <div className="grid2">
            <div className="panel">
              <div className="panel-title"><b>Uji percakapan AI</b><span className="online">● AI Aktif</span></div>
              <div className="chatbox">{messages.slice(-8).map((m, i) => <div key={i} className={`bubble ${m.role}`}>{m.text}</div>)}</div>
              <div className="composer"><input value={question} onChange={e => setQuestion(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} placeholder="Contoh: berapa harga Contoh Produk UMKM?"/><button className="primary" onClick={send}>Kirim</button></div>
            </div>
            <div className="panel">
              <div className="panel-title"><b>Sumber informasi AI</b></div>
              <div className="source-card"><strong>Produk & Harga</strong><small>{products.length} produk tersedia</small>{products.map(p => <div className="mini-row" key={p.id}><span>{p.name}</span><b>Rp{p.price.toLocaleString('id-ID')}</b></div>)}</div>
              <div className="source-card"><strong>Informasi Usaha</strong><small>{business.hours} • {business.location}</small></div>
              <div className="source-card"><strong>FAQ</strong><small>{faq.length} pertanyaan umum tersimpan</small></div>
              <div className="safe-note">🛡️ Jika informasi tidak tersedia, AI diarahkan untuk tidak mengarang dan menawarkan bantuan admin.</div>
            </div>
          </div>
        </section>}

        {tab === 'automation' && <section className="page">
          <div className="page-head"><div><span className="eyebrow">KATALOG #3</span><h2>WhatsApp AI Automation</h2><p>Jadikan WhatsApp sebagai asisten bisnis yang membantu melayani pelanggan.</p></div><button className="secondary" onClick={() => setTab('home')}>← Dashboard</button></div>
          <div className="automation-intro"><div><strong>{activeAutomationCount}</strong><span>automation aktif</span></div><div><strong>{automations.length}</strong><span>workflow tersedia</span></div><button className="primary" onClick={addAutomation}>+ Tambah Automation</button></div>
          <div className="automation-list">{automations.map(a => <div className="automation-card" key={a.id}><div className="automation-icon">⚙</div><div className="automation-main"><b>{a.name}</b><span>Jika: {a.trigger}</span><span>Maka: {a.action}</span></div><label className="switch"><input type="checkbox" checked={a.active} onChange={() => toggleAutomation(a.id)}/><span /></label></div>)}</div>
          <div className="automation-examples"><div><b>💬 Menjawab chat</b><span>AI Customer Service menangani pertanyaan pelanggan.</span></div><div><b>🛒 Menerima pesanan</b><span>Pesanan dapat diteruskan ke order engine JFS AI.</span></div><div><b>📝 Mencatat kebutuhan</b><span>Data percakapan dapat disimpan sebagai customer context.</span></div><div><b>⏰ Mengingatkan</b><span>Automation berjalan berdasarkan trigger dan waktu.</span></div><div><b>🔄 Follow-up</b><span>Kirim pesan lanjutan setelah kondisi terpenuhi.</span></div></div>
        </section>}

        {tab === 'business' && <section className="page"><div className="page-head"><div><span className="eyebrow">DATA BISNIS</span><h2>Knowledge Base</h2><p>Data ini menjadi sumber jawaban AI.</p></div><button className="secondary" onClick={() => setTab('home')}>← Dashboard</button></div><div className="grid2"><div className="panel"><div className="field"><label>Nama usaha</label><input value={business.name} onChange={e => setBusiness({ ...business, name: e.target.value })}/></div><div className="field"><label>Deskripsi</label><textarea value={business.description} onChange={e => setBusiness({ ...business, description: e.target.value })}/></div><div className="field"><label>Jam buka</label><input value={business.hours} onChange={e => setBusiness({ ...business, hours: e.target.value })}/></div><div className="field"><label>Lokasi</label><input value={business.location} onChange={e => setBusiness({ ...business, location: e.target.value })}/></div></div><div className="panel"><div className="panel-title"><b>Produk</b><button className="secondary" onClick={() => setProducts([...products, { id: Date.now(), name: 'Produk Baru', price: 100000, stock: 5, description: 'Deskripsi produk baru.' }])}>+ Produk</button></div>{products.map(p => <div className="product-row" key={p.id}><div><b>{p.name}</b><small>{p.description}</small></div><span>Rp{p.price.toLocaleString('id-ID')} • stok {p.stock}</span></div>)}<div className="panel-title faq-title"><b>FAQ</b><button className="secondary" onClick={() => setFaq([...faq, { id: Date.now(), q: 'Pertanyaan baru?', a: 'Jawaban baru.' }])}>+ FAQ</button></div>{faq.map(f => <div className="faq-row" key={f.id}><b>{f.q}</b><span>{f.a}</span></div>)}</div></div></section>}

        {tab === 'whatsapp' && <section className="page"><div className="page-head"><div><span className="eyebrow">CHANNEL</span><h2>WhatsApp Business</h2><p>Konfigurasi channel untuk tahap integrasi backend.</p></div><button className="secondary" onClick={() => setTab('home')}>← Dashboard</button></div><div className="panel connection"><div className="connection-status"><span className={waConnected ? 'status-good' : 'status-off'}>{waConnected ? '● Terhubung (demo)' : '○ Belum terhubung'}</span></div><div className="field"><label>Nomor WhatsApp Business</label><input value={waNumber} onChange={e => setWaNumber(e.target.value)} placeholder="628xxxxxxxxxx"/></div><button className="primary" onClick={connectWhatsApp}>{waConnected ? 'Perbarui konfigurasi' : 'Simpan konfigurasi'}</button>{notice && <div className="notice">{notice}</div>}<div className="integration-note"><b>Siap diintegrasikan ke JFS AI Platform</b><span>Frontend ini tidak menyimpan token rahasia. Webhook, WhatsApp Cloud API, AI provider, database, dan RLS harus dijalankan di backend/Edge Functions saat tahap produksi.</span></div></div></section>}
      </main>

      <nav className="bottom-nav">
        <button className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}>⌂<span>Dashboard</span></button>
        <button className={tab === 'cs' ? 'active' : ''} onClick={() => setTab('cs')}>✦<span>AI CS</span></button>
        <button className={tab === 'automation' ? 'active' : ''} onClick={() => setTab('automation')}>⚙<span>Automation</span></button>
        <button className={tab === 'business' ? 'active' : ''} onClick={() => setTab('business')}>▣<span>Data Bisnis</span></button>
        <button className={tab === 'whatsapp' ? 'active' : ''} onClick={() => setTab('whatsapp')}>◉<span>WhatsApp</span></button>
      </nav>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
