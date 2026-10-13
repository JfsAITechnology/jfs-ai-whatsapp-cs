import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase, supabaseConfigured } from './lib/supabase';
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
  const [tenantState, setTenantState] = useState('loading');
  const [accessState, setAccessState] = useState('checking');
  const [tenantCode, setTenantCode] = useState(new URLSearchParams(window.location.search).get('tenant') || new URLSearchParams(window.location.search).get('id') || '');
  const [tenantId, setTenantId] = useState(null);
  const [dataNotice, setDataNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function loadTenantData() {
      if (!tenantCode.trim()) {
        setAccessState('demo');
        if (!supabase) { setTenantState('demo'); setDataNotice('Supabase belum dikonfigurasi. Data yang tampil adalah contoh demo.'); return; }
        setTenantState('demo');
        setBusiness({ name: 'Usaha Saya', description: 'Usaha UMKM Anda', hours: 'Senin–Sabtu, 08.00–20.00', location: 'Alamat usaha Anda' });
        setProducts(initialProducts);
        setFaq(initialFaq);
        setDataNotice('Mode demo. Tambahkan ?tenant=KODE_TENANT pada URL untuk memuat data bisnis aktif.');
        return;
      }
      if (!supabase) {
        setAccessState('error');
        setTenantState('error');
        setProducts([]);
        setFaq([]);
        setDataNotice('Konfigurasi backend tidak tersedia. Data tenant nyata tidak dibuka.');
        return;
      }
      setAccessState('checking');
      setTenantState('loading');
      setTenantId(null);
      setProducts([]);
      setFaq([]);
      setDataNotice('Memeriksa login dan subscription…');
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (cancelled) return;
      if (sessionError || !sessionData?.session) {
        setAccessState('login');
        setTenantState('error');
        setBusiness({ name: 'Login diperlukan', description: 'Masuk melalui JFS AI Platform untuk membuka tenant.', hours: '—', location: '—' });
        setDataNotice('Tenant nyata hanya tersedia setelah login melalui JFS AI Platform.');
        return;
      }
      const { data: subscriptionRows, error: subscriptionError } = await supabase.rpc('jfs_get_my_app_subscription', { p_app_code: 'WHATSAPP-CS' });
      if (cancelled) return;
      const subscription = Array.isArray(subscriptionRows) ? subscriptionRows[0] : subscriptionRows;
      const subscriptionStatus = subscription?.status;
      if (subscriptionError || !['active', 'trial', 'expiring'].includes(subscriptionStatus)) {
        setAccessState('blocked');
        setTenantState('error');
        setBusiness({ name: 'Subscription belum aktif', description: 'Aktifkan trial atau paket JFS AI WhatsApp CS untuk mengelola tenant.', hours: '—', location: '—' });
        setDataNotice('Akses tenant dibatasi sampai subscription WhatsApp CS berstatus trial atau aktif.');
        return;
      }
      setAccessState(subscriptionStatus);
      const { data: tenantRows, error: tenantError } = await supabase.rpc('jfs_owner_customer_service_tenant', { p_tenant_code: tenantCode.trim() });
      const tenant = Array.isArray(tenantRows) ? tenantRows[0] : tenantRows;
      if (cancelled) return;
      if (tenantError || !tenant) {
        setProducts([]);
        setFaq([]);
        setBusiness({ name: 'Tenant tidak tersedia', description: 'Data bisnis tidak dapat diakses.', hours: 'Jam operasional tidak tersedia.', location: 'Alamat tidak tersedia.' });
        setTenantState('error');
        setDataNotice('Data tenant tidak ditemukan atau belum dapat diakses. Data demo tidak digunakan untuk menjawab pelanggan. Periksa kode tenant dan status bisnis.');
        return;
      }
      setTenantId(tenant.id);
      setBusiness({ name: tenant.business_name || 'Usaha', description: tenant.business_type || 'Informasi usaha', hours: 'Jam operasional belum tersedia di database.', location: [tenant.address, tenant.city, tenant.province].filter(Boolean).join(', ') || 'Alamat belum tersedia di database.' });
      const [{ data: dbProducts, error: productError }, { data: knowledge, error: knowledgeError }] = await Promise.all([
        supabase.rpc('jfs_owner_customer_service_products', { p_tenant_code: tenant.tenant_code }),
        supabase.rpc('jfs_owner_customer_service_knowledge', { p_tenant_code: tenant.tenant_code })
      ]);
      if (cancelled) return;
      setProducts(!productError ? (dbProducts || []).map(p => ({ id: p.id, name: p.name, price: Number(p.price || 0), stock: null, description: p.description || p.category || p.brand || 'Deskripsi belum tersedia.' })) : []);
      setFaq(!knowledgeError ? (knowledge || []).map(k => ({ id: k.id, q: k.title, a: k.content })) : []);
      setTenantState('connected');
      const dataWarnings = [productError && 'produk', knowledgeError && 'knowledge base'].filter(Boolean);
      setDataNotice(dataWarnings.length
        ? `Tenant ${tenant.tenant_code} ditemukan, tetapi data ${dataWarnings.join(' dan ')} gagal dimuat. Informasi demo tidak digunakan.`
        : `Terhubung ke data tenant ${tenant.tenant_code}. Mode baca saja; perubahan data bisnis memerlukan login dan izin admin.`);
    }
    loadTenantData();
    return () => { cancelled = true; };
  }, [tenantCode]);

  const answer = useMemo(() => {
    const q = question.trim().toLowerCase();
    if (!q) return '';
    const product = products.find(p => q.includes(p.name.toLowerCase()));
    if (product) return `${product.name}: Rp${product.price.toLocaleString('id-ID')}.${product.stock == null ? '' : ` Stok: ${product.stock} unit.`} ${product.description}`;
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

  if (tenantCode.trim() && !['trial', 'active', 'expiring'].includes(accessState)) {
    const gateTitle = accessState === 'checking' ? 'Memeriksa akses aplikasi…' : accessState === 'login' ? 'Login diperlukan' : 'Subscription diperlukan';
    const gateMessage = accessState === 'checking'
      ? 'Memeriksa sesi JFS AI dan status trial/subscription.'
      : accessState === 'login'
        ? 'Masuk melalui JFS AI Platform terlebih dahulu. Sesi login platform akan digunakan untuk memeriksa akses WhatsApp CS.'
        : 'Tenant bisnis tidak dapat dibuka sebelum trial atau subscription JFS AI WhatsApp CS aktif.';
    return (
      <div className="app">
        <header className="topbar"><div className="brand"><span className="brand-mark">✦</span><span><b>JFS AI</b><small>WHATSAPP BUSINESS AI</small></span></div></header>
        <main className="shell"><section className="page">
          <div className="panel"><span className="eyebrow">JFS AI SUBSCRIPTION</span><h2>{gateTitle}</h2><p>{gateMessage}</p>
            <div className="notice" role="status">{dataNotice || 'Status akses sedang diperiksa.'}</div>
            <div className="hero-actions" style={{ marginTop: 18 }}>
              <button className="primary" onClick={() => { window.location.href = 'https://jfsaitechnology.github.io/jfs-ai-platform/'; }}>Login / Dashboard JFS AI →</button>
              <button className="secondary" onClick={() => { window.location.href = 'https://jfsaitechnology.github.io/jfs-ai-platform/checkout.html?app=WHATSAPP-CS'; }}>Lihat Paket WhatsApp CS →</button>
            </div>
          </div>
        </section></main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => setTab('home')}>
          <span className="brand-mark">✦</span>
          <span><b>JFS AI</b><small>WHATSAPP BUSINESS AI</small></span>
        </button>
        <div className="top-status"><span className="dot" /> {tenantState === 'connected' ? 'Data bisnis terhubung' : tenantState === 'loading' && supabaseConfigured ? 'Memuat data bisnis…' : 'Mode Demo'}</div>
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
              <div className="panel-title"><b>Sumber informasi AI</b><span className={tenantState === 'connected' ? 'online' : 'status-off'}>{tenantState === 'connected' ? '● Data database' : '● Data demo'}</span></div>
              <div className="source-card"><strong>Produk & Harga</strong><small>{products.length} produk tersedia</small>{products.map(p => <div className="mini-row" key={p.id}><span>{p.name}</span><b>Rp{p.price.toLocaleString('id-ID')}</b></div>)}</div>
              <div className="source-card"><strong>Informasi Usaha</strong><small>{business.hours} • {business.location}</small></div>
              <div className="source-card"><strong>FAQ</strong><small>{faq.length} pertanyaan umum tersimpan</small></div>
              <div className="safe-note">🛡️ Jika informasi tidak tersedia, AI diarahkan untuk tidak mengarang dan menawarkan bantuan admin.</div>{dataNotice && <div className="notice" role="status">{dataNotice}</div>}
            </div>
          </div>
        </section>}

        {tab === 'automation' && <section className="page">
          <div className="page-head"><div><span className="eyebrow">KATALOG #3</span><h2>WhatsApp AI Automation</h2><p>Jadikan WhatsApp sebagai asisten bisnis yang membantu melayani pelanggan.</p></div><button className="secondary" onClick={() => setTab('home')}>← Dashboard</button></div>
          <div className="automation-intro"><div><strong>{activeAutomationCount}</strong><span>automation aktif</span></div><div><strong>{automations.length}</strong><span>workflow tersedia</span></div><button className="primary" onClick={addAutomation}>+ Tambah Automation</button></div>
          <div className="automation-list">{automations.map(a => <div className="automation-card" key={a.id}><div className="automation-icon">⚙</div><div className="automation-main"><b>{a.name}</b><span>Jika: {a.trigger}</span><span>Maka: {a.action}</span></div><label className="switch"><input type="checkbox" checked={a.active} onChange={() => toggleAutomation(a.id)}/><span /></label></div>)}</div>
          <div className="automation-examples"><div><b>💬 Menjawab chat</b><span>AI Customer Service menangani pertanyaan pelanggan.</span></div><div><b>🛒 Menerima pesanan</b><span>Pesanan dapat diteruskan ke order engine JFS AI.</span></div><div><b>📝 Mencatat kebutuhan</b><span>Data percakapan dapat disimpan sebagai customer context.</span></div><div><b>⏰ Mengingatkan</b><span>Automation berjalan berdasarkan trigger dan waktu.</span></div><div><b>🔄 Follow-up</b><span>Kirim pesan lanjutan setelah kondisi terpenuhi.</span></div></div>
        </section>}

        {tab === 'business' && <section className="page"><div className="page-head"><div><span className="eyebrow">DATA BISNIS</span><h2>Knowledge Base</h2><p>Data ini menjadi sumber jawaban AI.</p>{tenantState === 'connected' && <small>Tenant: {tenantCode} · baca saja</small>}</div><button className="secondary" onClick={() => setTab('home')}>← Dashboard</button></div><div className="grid2"><div className="panel"><div className="safe-note">{tenantState === 'connected' ? 'Data diambil dari Supabase dan ditampilkan dalam mode baca saja.' : 'Mode demo: perubahan di halaman ini hanya tersimpan sementara di browser.'}</div><div className="field"><label>Nama usaha</label><input value={business.name} onChange={e => setBusiness({ ...business, name: e.target.value })}/></div><div className="field"><label>Deskripsi</label><textarea value={business.description} onChange={e => setBusiness({ ...business, description: e.target.value })}/></div><div className="field"><label>Jam buka</label><input value={business.hours} onChange={e => setBusiness({ ...business, hours: e.target.value })}/></div><div className="field"><label>Lokasi</label><input value={business.location} onChange={e => setBusiness({ ...business, location: e.target.value })}/></div></div><div className="panel"><div className="panel-title"><b>Produk</b>{tenantState !== 'connected' && <button className="secondary" onClick={() => setProducts([...products, { id: Date.now(), name: 'Produk Baru', price: 100000, stock: 5, description: 'Deskripsi produk baru.' }])}>+ Produk demo</button>}</div>{products.map(p => <div className="product-row" key={p.id}><div><b>{p.name}</b><small>{p.description}</small></div><span>Rp{p.price.toLocaleString('id-ID')}{p.stock == null ? ' • stok tidak ditampilkan' : ` • stok ${p.stock}`}</span></div>)}<div className="panel-title faq-title"><b>FAQ / Knowledge</b>{tenantState !== 'connected' && <button className="secondary" onClick={() => setFaq([...faq, { id: Date.now(), q: 'Pertanyaan baru?', a: 'Jawaban baru.' }])}>+ FAQ demo</button>}</div>{faq.map(f => <div className="faq-row" key={f.id}><b>{f.q}</b><span>{f.a}</span></div>)}</div></div></section>}

        {tab === 'whatsapp' && <section className="page"><div className="page-head"><div><span className="eyebrow">CHANNEL</span><h2>WhatsApp Business</h2><p>Konfigurasi channel untuk tahap integrasi backend.</p></div><button className="secondary" onClick={() => setTab('home')}>← Dashboard</button></div><div className="panel connection"><div className="connection-status"><span className={waConnected ? 'status-good' : 'status-off'}>{waConnected ? '● Terhubung (demo)' : '○ Belum terhubung'}</span></div><div className="field"><label>Nomor WhatsApp Business</label><input value={waNumber} onChange={e => setWaNumber(e.target.value)} placeholder="628xxxxxxxxxx"/></div><button className="primary" onClick={connectWhatsApp}>{waConnected ? 'Perbarui konfigurasi demo' : 'Simpan konfigurasi demo'}</button>{notice && <div className="notice">{notice}</div>}<div className="integration-note"><b>Siap diintegrasikan ke JFS AI Platform</b><span>Frontend ini tidak menyimpan token rahasia. Webhook, WhatsApp Cloud API, AI provider, database, dan RLS harus dijalankan di backend/Edge Functions saat tahap produksi.</span></div></div></section>}
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
