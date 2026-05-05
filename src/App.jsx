import { useState, useEffect, useRef, useCallback } from "react";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://swrpladhwaspibpoegwn.supabase.co";
const SUPABASE_KEY = "sb_publishable_1m5yOZvVzFfXQQYqoN8h_A_nd56vaPI";

// Simple Supabase client sans library
const db = {
  async get(table, filters = {}) {
    let url = `${SUPABASE_URL}/rest/v1/${table}?select=*&order=created_at.desc`;
    Object.entries(filters).forEach(([k, v]) => { url += `&${k}=eq.${v}`; });
    const r = await fetch(url, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } });
    return r.json();
  },
  async insert(table, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data),
    });
    return r.json();
  },
  async update(table, id, data) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(data),
    });
    return r.json();
  },
  async delete(table, id) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    });
  },
};

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const APP_PASSWORD  = "MUNCHY2026";
const CASHBACK_RATE = 0.05;
const DICE_FACES    = ["","⚀","⚁","⚂","⚃","⚄","⚅"];

const C = {
  pink:"#FF3D7F", yellow:"#FFD600", blue:"#00C2FF", purple:"#9B51E0",
  green:"#00E676", bg:"#0D0D1A", card:"#16162A", cardLight:"#1E1E35",
  text:"#FFFFFF", muted:"#8888AA",
};

const TIERS = [
  { name:"Sucre",     min:0,   max:9.99,     color:"#C0C0C0", emoji:"🍬", discount:5  },
  { name:"Caramel",   min:10,  max:24.99,    color:"#FFD600", emoji:"🍭", discount:10 },
  { name:"Chocolat",  min:25,  max:49.99,    color:"#CD7F32", emoji:"🍫", discount:15 },
  { name:"Candy VIP", min:50,  max:Infinity, color:"#FF3D7F", emoji:"👑", discount:20 },
];

const getTier  = c   => TIERS.find(t => c >= t.min && c <= t.max) || TIERS[0];
const genCode  = pfx => (pfx||"MUNCHY") + "-" + Math.random().toString(36).substring(2,8).toUpperCase();
const qrUrl    = (data,sz=160) => `https://api.qrserver.com/v1/create-qr-code/?size=${sz}x${sz}&data=${encodeURIComponent(data)}&format=png`;
const clientQr = id  => `MUNCHY-CLIENT-${id}`;
const today    = ()  => new Date().toISOString().split("T")[0];
const fmt      = n   => Number(n||0).toFixed(2);

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginScreen({ onSuccess }) {
  const [pwd, setPwd]   = useState("");
  const [err, setErr]   = useState(false);
  const [shake, setShake] = useState(false);

  function login() {
    if (pwd === APP_PASSWORD) { sessionStorage.setItem("munchys-auth","1"); onSuccess(); }
    else { setErr(true); setShake(true); setPwd(""); setTimeout(()=>{ setErr(false); setShake(false); }, 2000); }
  }

  return (
    <div style={{ background:C.bg, minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Georgia',serif" }}>
      <div style={{ textAlign:"center", padding:"32px 24px", maxWidth:"360px", width:"100%" }}>
        <div style={{ fontSize:"72px", marginBottom:"8px" }}>🍬</div>
        <div style={{ fontSize:"26px", fontWeight:"bold", letterSpacing:"3px", color:C.text, marginBottom:"4px" }}>MUNCHYS CANDY</div>
        <div style={{ fontSize:"12px", color:C.muted, marginBottom:"36px", letterSpacing:"1px" }}>Programme de Fidélité</div>
        <div style={{ background:C.card, borderRadius:"20px", padding:"28px 24px", border:"1px solid #ffffff15", transform:shake?"translateX(-8px)":"none", transition:"transform 0.1s" }}>
          <div style={{ fontSize:"14px", color:C.muted, marginBottom:"16px" }}>🔐 Accès réservé</div>
          <input type="password" placeholder="Mot de passe" value={pwd}
            onChange={e=>{ setPwd(e.target.value); setErr(false); }}
            onKeyDown={e=>e.key==="Enter"&&login()}
            style={{ background:C.cardLight, border:`1px solid ${err?C.pink:"#ffffff20"}`, borderRadius:"12px", padding:"14px 16px", color:C.text, fontSize:"16px", outline:"none", width:"100%", textAlign:"center", letterSpacing:"4px", marginBottom:"12px", boxSizing:"border-box" }}
            autoFocus />
          {err && <div style={{ color:C.pink, fontSize:"13px", marginBottom:"12px" }}>❌ Mot de passe incorrect</div>}
          <button onClick={login} style={{ background:`linear-gradient(135deg,${C.pink},${C.purple})`, border:"none", borderRadius:"12px", padding:"14px", color:"#fff", fontWeight:"bold", cursor:"pointer", fontSize:"15px", width:"100%" }}>
            Entrer 🍭
          </button>
        </div>
        <div style={{ fontSize:"11px", color:"#ffffff22", marginTop:"24px" }}>munchys-candy.vercel.app</div>
      </div>
    </div>
  );
}

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function MunchysLoyalty() {
  const [auth, setAuth] = useState(() => sessionStorage.getItem("munchys-auth") === "1");
  if (!auth) return <LoginScreen onSuccess={() => setAuth(true)} />;
  return <MainApp />;
}

function MainApp() {
  const [customers,    setCustomers]    = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [saveStatus,   setSaveStatus]   = useState("saved");
  const [tab,          setTab]          = useState("dashboard");
  const [expandedId,   setExpandedId]   = useState(null);
  const [selected,     setSelected]     = useState(null);
  const [purchaseAmt,  setPurchaseAmt]  = useState("");
  const [purchaseMsg,  setPurchaseMsg]  = useState(null);
  const [useAmt,       setUseAmt]       = useState("");
  const [useMsg,       setUseMsg]       = useState(null);
  const [newCust,      setNewCust]      = useState({ name:"", email:"", phone:"" });
  const [addMsg,       setAddMsg]       = useState(null);
  const [cartAmt,      setCartAmt]      = useState("");
  const [diceResult,   setDiceResult]   = useState(null);
  const [diceRolling,  setDiceRolling]  = useState(false);
  const [diceWon,      setDiceWon]      = useState(false);
  const [promoCode,    setPromoCode]    = useState(null);
  const [emailTpl,     setEmailTpl]     = useState(null);
  const [groupTpl,     setGroupTpl]     = useState(null);
  const [scanActive,   setScanActive]   = useState(false);
  const [scanResult,   setScanResult]   = useState(null);
  const [scanError,    setScanError]    = useState(null);
  const [scanLoading,  setScanLoading]  = useState(false);
  const [jsqrReady,    setJsqrReady]    = useState(false);
  const [deleteConfirm,setDeleteConfirm]= useState(null);
  const [searchQuery,  setSearchQuery]  = useState("");
  const [copiedId,     setCopiedId]     = useState(null);
  const [sendingId,    setSendingId]    = useState(null);
  const [sendMsg,      setSendMsg]      = useState(null);

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);

  // ── Chargement depuis Supabase ──
  useEffect(() => {
    async function load() {
      try {
        const data = await db.get("customers");
        setCustomers(Array.isArray(data) ? data.map(mapFromDb) : []);
      } catch {
        setCustomers([]);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Mapping DB → app
  function mapFromDb(c) {
    return {
      id: c.id, name: c.name, email: c.email, phone: c.phone||"",
      cagnotte: parseFloat(c.cagnotte||0), joinDate: c.join_date||today(),
      purchases: c.purchases||0, totalSpent: parseFloat(c.total_spent||0),
    };
  }

  function logout() { sessionStorage.removeItem("munchys-auth"); window.location.reload(); }

  // ── CRUD clients ──
  async function addCustomer() {
    if (!newCust.name || !newCust.email) return setAddMsg({ type:"error", text:"Nom et email obligatoires." });
    if (customers.some(c => c.email.toLowerCase() === newCust.email.toLowerCase()))
      return setAddMsg({ type:"error", text:"Cet email existe déjà." });

    setSaveStatus("saving");
    try {
      const id = Date.now();
      const inserted = await db.insert("customers", {
        id, name: newCust.name.trim(), email: newCust.email.trim(),
        phone: newCust.phone.trim(), cagnotte: 0,
        join_date: today(), purchases: 0, total_spent: 0,
      });
      const newC = Array.isArray(inserted) ? mapFromDb(inserted[0]) : { id, ...newCust, cagnotte:0, joinDate:today(), purchases:0, totalSpent:0 };
      setCustomers(prev => [...prev, newC]);
      setNewCust({ name:"", email:"", phone:"" });
      setAddMsg({ type:"success", text:"✅ Client ajouté et sauvegardé dans le cloud ! 🎉" });
      setSaveStatus("saved");
    } catch {
      setAddMsg({ type:"error", text:"❌ Erreur de connexion. Réessaie." });
      setSaveStatus("error");
    }
    setTimeout(() => setAddMsg(null), 4000);
  }

  async function updateCustomer(id, changes) {
    setSaveStatus("saving");
    try {
      const dbChanges = {};
      if (changes.cagnotte !== undefined) dbChanges.cagnotte = changes.cagnotte;
      if (changes.purchases !== undefined) dbChanges.purchases = changes.purchases;
      if (changes.totalSpent !== undefined) dbChanges.total_spent = changes.totalSpent;
      await db.update("customers", id, dbChanges);
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, ...changes } : c));
      if (selected?.id === id) setSelected(prev => ({ ...prev, ...changes }));
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  }

  async function deleteCustomer(id) {
    setSaveStatus("saving");
    try {
      await db.delete("customers", id);
      setCustomers(prev => prev.filter(c => c.id !== id));
      if (selected?.id === id) setSelected(null);
      setExpandedId(null); setDeleteConfirm(null);
      setSaveStatus("saved");
    } catch { setSaveStatus("error"); }
  }

  // ── Achat ──
  async function addPurchase() {
    const amount = parseFloat(purchaseAmt);
    if (!selected) return setPurchaseMsg({ type:"error", text:"Sélectionne un client." });
    if (isNaN(amount) || amount < 1) return setPurchaseMsg({ type:"error", text:"Minimum 1€." });
    const earned = parseFloat((amount * CASHBACK_RATE).toFixed(2));
    const updated = {
      cagnotte: parseFloat((selected.cagnotte + earned).toFixed(2)),
      purchases: selected.purchases + 1,
      totalSpent: parseFloat(((selected.totalSpent||0) + amount).toFixed(2)),
    };
    await updateCustomer(selected.id, updated);
    setPurchaseMsg({ type:"success", text:`✅ +${fmt(earned)}€ en cagnotte pour ${fmt(amount)}€ d'achat !` });
    setPurchaseAmt("");
    setTimeout(() => setPurchaseMsg(null), 4000);
  }

  // ── Utiliser cagnotte ──
  async function useCagnotte() {
    const amount = parseFloat(useAmt);
    if (!selected) return setUseMsg({ type:"error", text:"Sélectionne un client." });
    if (isNaN(amount) || amount <= 0) return setUseMsg({ type:"error", text:"Montant invalide." });
    if (amount > selected.cagnotte) return setUseMsg({ type:"error", text:`Maximum disponible : ${fmt(selected.cagnotte)}€` });
    const updated = { cagnotte: parseFloat((selected.cagnotte - amount).toFixed(2)) };
    await updateCustomer(selected.id, updated);
    setUseMsg({ type:"success", text:`✅ ${fmt(amount)}€ utilisés ! Reste : ${fmt(updated.cagnotte)}€` });
    setUseAmt("");
    setTimeout(() => setUseMsg(null), 4000);
  }

  // ── Dé ──
  function rollDice() {
    if (diceRolling) return;
    setDiceRolling(true); setDiceResult(null); setDiceWon(false);
    let count = 0, r = 1;
    const iv = setInterval(() => {
      r = Math.floor(Math.random() * 6) + 1; setDiceResult(r); count++;
      if (count >= 14) { clearInterval(iv); setDiceRolling(false); if (r === 6) setDiceWon(true); }
    }, 80);
  }

  // ── Emails ──
  // ── Envoi email via Resend ──
  const [sending,    setSending]    = useState(false);
  const [sendResult, setSendResult] = useState(null);

  async function sendEmail(to, subject, body) {
    if (!to) return setSendResult({ type:"error", text:"Adresse email manquante !" });
    setSending(true); setSendResult(null);
    try {
      const r = await fetch("/api/send-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body }),
      });
      const data = await r.json();
      if (data.success) {
        setSendResult({ type:"success", text:`✅ Email envoyé à ${to} !` });
        setTimeout(() => setSendResult(null), 5000);
      } else {
        setSendResult({ type:"error", text:`❌ Erreur : ${data.error}` });
      }
    } catch {
      setSendResult({ type:"error", text:"❌ Erreur de connexion" });
    }
    setSending(false);
  }

  function generateEmail(type, customer) {
    const c = customer || selected; if (!c) return;
    const tier = getTier(c.cagnotte), first = c.name.split(" ")[0], code = genCode("CANDY");
    const tpls = {
      welcome:  { subject:`Bienvenue chez Munchys Candy, ${first} ! 🍬`, body:`Bonjour ${first},\n\nMerci d'avoir rejoint notre programme de fidélité !\n\nChaque achat te rapporte 5% en cagnotte.\nTa cagnotte actuelle : ${fmt(c.cagnotte)}€\n\nCode de bienvenue : ${code}\n✅ -5% sur ta prochaine commande\n\nÀ très bientôt ! 🍭\n\nL'équipe Munchys Candy` },
      promo:    { subject:`Un cadeau spécial pour toi, ${first} ! 🎁`, body:`Bonjour ${first},\n\nTu es client(e) ${tier.emoji} ${tier.name} !\n\nCode promo : ${code}\n✅ -${tier.discount}% sur tous les bonbons\n⏳ Valable 30 jours\n\nL'équipe Munchys Candy` },
      birthday: { subject:`Joyeux anniversaire de Munchys ! 🎂`, body:`Bonjour ${first},\n\nJoyeux anniversaire ! 🎉\n\nCode : ${code}\n🎁 -15% sur toute ta commande\n⏳ Valable jusqu'à fin du mois\n\nL'équipe Munchys Candy` },
      offre5:   { subject:`🍬 Offre spéciale -5% chez Munchys !`, body:`Bonjour ${first},\n\nCode promo : ${code}\n✅ -5% sur toute la boutique\n⏳ Cette semaine seulement !\n\nL'équipe Munchys Candy` },
      offre10:  { subject:`🍭 -10% chez Munchys Candy !`, body:`Bonjour ${first},\n\nCode promo : ${code}\n✅ -10% sur toute la boutique\n⏳ Valable jusqu'à dimanche !\n\nL'équipe Munchys Candy` },
      offre15:  { subject:`👑 Offre VIP -15% chez Munchys !`, body:`Bonjour ${first},\n\nCode VIP : ${code}\n✅ -15% sur toute la boutique\n⏳ Valable 15 jours\n\nL'équipe Munchys Candy` },
    };
    setEmailTpl(tpls[type]);
  }

  function generateGroupEmail(type) {
    const code = genCode("CANDY");
    const tpls = {
      offre5:   { subject:`🍬 Offre spéciale -5% chez Munchys !`, body: name => `Bonjour ${name},\n\nCode promo : ${code}\n✅ -5% sur toute la boutique\n⏳ Cette semaine seulement !\n\nL'équipe Munchys Candy` },
      offre10:  { subject:`🍭 -10% chez Munchys Candy !`, body: name => `Bonjour ${name},\n\nCode promo : ${code}\n✅ -10% sur toute la boutique\n⏳ Valable jusqu'à dimanche !\n\nL'équipe Munchys Candy` },
      offre15:  { subject:`👑 Offre VIP -15% chez Munchys !`, body: name => `Bonjour ${name},\n\nCode VIP : ${code}\n✅ -15% sur toute la boutique\n⏳ Valable 15 jours\n\nL'équipe Munchys Candy` },
      promo:    { subject:`🎁 Un cadeau vous attend chez Munchys !`, body: (name, tier) => `Bonjour ${name},\n\nCode promo : ${genCode("CANDY")}\n✅ -${tier.discount}% sur tous les bonbons\n⏳ Valable 30 jours\n\nL'équipe Munchys Candy` },
    };
    setGroupTpl({ ...tpls[type], type });
  }

  function copyEmail(text, id) {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // ── Envoi email via Resend ──
  async function sendEmail(to, subject, body, id) {
    setSendingId(id);
    setSendMsg(null);
    try {
      const r = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body }),
      });
      const data = await r.json();
      if (data.success) {
        setSendMsg({ type: 'success', text: `✅ Email envoyé à ${to} !` });
      } else {
        setSendMsg({ type: 'error', text: `❌ Erreur : ${data.error}` });
      }
    } catch {
      setSendMsg({ type: 'error', text: '❌ Erreur de connexion' });
    }
    setSendingId(null);
    setTimeout(() => setSendMsg(null), 5000);
  }

  // ── Scanner ──
  useEffect(() => {
    if (window.jsQR) { setJsqrReady(true); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jsqr/1.4.0/jsQR.js";
    s.onload = () => setJsqrReady(true);
    document.head.appendChild(s);
  }, []);

  useEffect(() => { if (tab !== "scanner") stopScanner(); }, [tab]);

  function stopScanner() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null; setScanActive(false);
  }

  const scanFrame = useCallback(() => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || !window.jsQR) return;
    const ctx = canvas.getContext("2d");
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts:"dontInvert" });
      if (code?.data?.startsWith("MUNCHY-CLIENT-")) {
        const id = parseInt(code.data.replace("MUNCHY-CLIENT-",""), 10);
        const found = customers.find(c => c.id === id);
        setScanResult(found ? { type:"found", customer:found } : { type:"unknown" });
        setSelected(found || null);
        stopScanner(); return;
      }
    }
    rafRef.current = requestAnimationFrame(scanFrame);
  }, [customers]);

  async function startScanner() {
    setScanError(null); setScanResult(null); setScanLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:"environment" } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setScanActive(true); setScanLoading(false);
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setScanLoading(false);
      setScanError("Accès caméra refusé. Autorise la caméra dans les paramètres.");
    }
  }

  // ── Styles ──
  const S = {
    app:    { background:C.bg, minHeight:"100vh", fontFamily:"'Georgia',serif", color:C.text, paddingBottom:"50px" },
    header: { background:"linear-gradient(135deg,#FF3D7F,#9B51E0 50%,#00C2FF)", padding:"20px 24px", display:"flex", alignItems:"center", gap:"14px" },
    tabs:   { display:"flex", gap:"2px", padding:"14px 18px 0", borderBottom:"1px solid #ffffff15", background:C.card, flexWrap:"wrap" },
    tab: a  => ({ padding:"9px 13px", borderRadius:"8px 8px 0 0", cursor:"pointer", fontSize:"12px", fontWeight:a?"bold":"normal", background:a?C.bg:"transparent", color:a?C.pink:C.muted, border:"none", transition:"all .2s" }),
    body:   { padding:"18px" },
    sec:    { background:C.card, borderRadius:"16px", padding:"18px", marginBottom:"16px", border:"1px solid #ffffff10" },
    stitle: { fontSize:"14px", fontWeight:"bold", marginBottom:"12px", color:C.yellow },
    input:  { background:C.cardLight, border:"1px solid #ffffff20", borderRadius:"10px", padding:"10px 14px", color:C.text, fontSize:"14px", outline:"none", width:"100%", boxSizing:"border-box" },
    btn: c  => ({ background:c||C.pink, border:"none", borderRadius:"10px", padding:"10px 18px", color:"#fff", fontWeight:"bold", cursor:"pointer", fontSize:"13px" }),
    badge:c => ({ background:c+"33", color:c, border:`1px solid ${c}66`, borderRadius:"20px", padding:"3px 10px", fontSize:"11px", fontWeight:"bold", display:"inline-block" }),
    msg: t  => ({ padding:"10px 14px", borderRadius:"10px", fontSize:"13px", marginTop:"10px", background:t==="success"?"#00E67622":"#FF3D7F22", border:`1px solid ${t==="success"?C.green:C.pink}44`, color:t==="success"?C.green:C.pink }),
    row: s  => ({ display:"flex", alignItems:"center", gap:"10px", padding:"11px", borderRadius:"12px", cursor:"pointer", background:s?"#FF3D7F22":"transparent", border:s?"1px solid #FF3D7F44":"1px solid transparent", transition:"all .2s", marginBottom:"6px" }),
    card:c  => ({ background:`linear-gradient(135deg,${c}44,${c}11)`, border:`2px solid ${c}88`, borderRadius:"20px", padding:"20px", marginBottom:"10px", marginTop:"-4px" }),
    stat:c  => ({ background:`linear-gradient(135deg,${c}22,${c}05)`, border:`1px solid ${c}44`, borderRadius:"14px", padding:"16px" }),
  };

  const totalCagnotte = customers.reduce((a,c) => a+c.cagnotte, 0);
  const topClient     = [...customers].sort((a,b) => b.cagnotte-a.cagnotte)[0];

  const filteredCustomers = customers.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.phone||"").replace(/\s/g,"").includes(q.replace(/\s/g,""));
  });

  const CustomerPicker = ({ onPick, current }) => (
    <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
      {customers.map(c => {
        const tier = getTier(c.cagnotte), sel = current?.id === c.id;
        return <div key={c.id} onClick={() => onPick(c)} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 14px", borderRadius:"10px", cursor:"pointer", background:sel?"#FF3D7F22":"transparent", border:sel?`1px solid ${tier.color}`:"1px solid #ffffff20", transition:"all .2s" }}>
          <span>{tier.emoji}</span><span style={{ fontSize:"13px" }}>{c.name}</span><span style={{ fontSize:"11px", color:tier.color }}>{fmt(c.cagnotte)}€</span>
        </div>;
      })}
    </div>
  );

  // ── Écran chargement ──
  if (loading) return (
    <div style={{ ...S.app, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"20px" }}>
      <div style={{ fontSize:"50px" }}>🍬</div>
      <div style={{ fontSize:"18px", fontWeight:"bold" }}>Chargement...</div>
      <div style={{ fontSize:"13px", color:C.muted }}>Connexion à la base de données cloud ☁️</div>
    </div>
  );

  return (
    <div style={S.app}>

      {/* Header */}
      <div style={S.header}>
        <div style={{ fontSize:"34px" }}>🍬</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:"22px", fontWeight:"bold", letterSpacing:"2px" }}>MUNCHYS CANDY</div>
          <div style={{ fontSize:"11px", opacity:.8 }}>Programme de Fidélité — 5% en cagnotte</div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"6px" }}>
          <div style={{ fontSize:"11px", padding:"4px 10px", borderRadius:"20px",
            background:saveStatus==="saved"?"#00E67622":saveStatus==="error"?"#FF3D7F22":"#FFD60022",
            color:saveStatus==="saved"?C.green:saveStatus==="error"?C.pink:C.yellow,
            border:`1px solid ${saveStatus==="saved"?C.green:saveStatus==="error"?C.pink:C.yellow}44` }}>
            {saveStatus==="saved"?"☁️ Cloud sauvegardé":saveStatus==="error"?"⚠️ Erreur connexion":"⏳ Sauvegarde..."}
          </div>
          <button onClick={logout} style={{ fontSize:"10px", background:"#ffffff15", border:"none", borderRadius:"20px", padding:"3px 10px", color:"#fff8", cursor:"pointer" }}>🔒 Déconnexion</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {[["dashboard","📊 Dashboard"],["clients","👥 Clients"],["scanner","📷 Scanner QR"],["achat","💰 Achat"],["de","🎲 Dé"],["emails","📧 Emails"]].map(([id,lbl]) => (
          <button key={id} style={S.tab(tab===id)} onClick={() => setTab(id)}>{lbl}</button>
        ))}
      </div>

      <div style={S.body}>

        {/* DASHBOARD */}
        {tab==="dashboard" && <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"12px", marginBottom:"18px" }}>
            {[[C.pink,"Total Clients",customers.length,"inscrits"],[C.yellow,"Cagnottes",fmt(totalCagnotte)+"€","distribuées"],[C.blue,"Top Client",topClient?.name.split(" ")[0]||"-",fmt(topClient?.cagnotte||0)+"€"],[C.purple,"Taux Cagnotte","5%","de chaque achat"]].map(([c,l,v,s]) => (
              <div key={l} style={S.stat(c)}>
                <div style={{ fontSize:"10px", color:C.muted, textTransform:"uppercase", letterSpacing:"1px" }}>{l}</div>
                <div style={{ fontSize:"26px", fontWeight:"bold", color:c, margin:"4px 0" }}>{v}</div>
                <div style={{ fontSize:"11px", color:C.muted }}>{s}</div>
              </div>
            ))}
          </div>
          <div style={S.sec}>
            <div style={S.stitle}>🏆 Niveaux de Fidélité</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:"8px" }}>
              {TIERS.map(tier => {
                const n = customers.filter(c => c.cagnotte>=tier.min && c.cagnotte<=tier.max).length;
                return <div key={tier.name} style={{ background:tier.color+"15", border:`1px solid ${tier.color}44`, borderRadius:"12px", padding:"12px", textAlign:"center" }}>
                  <div style={{ fontSize:"22px" }}>{tier.emoji}</div>
                  <div style={{ fontWeight:"bold", color:tier.color, fontSize:"12px" }}>{tier.name}</div>
                  <div style={{ fontSize:"10px", color:C.muted, margin:"2px 0" }}>{tier.min}–{tier.max===Infinity?"∞":tier.max}€</div>
                  <div style={{ fontSize:"16px", fontWeight:"bold" }}>{n} <span style={{ fontSize:"10px", color:C.muted }}>clients</span></div>
                  <div style={{ fontSize:"11px", color:tier.color }}>-{tier.discount}%</div>
                </div>;
              })}
            </div>
          </div>
          <div style={{ ...S.sec, background:"#00E67608", border:"1px solid #00E67633" }}>
            <div style={S.stitle}>☁️ Sauvegarde Cloud Active</div>
            <p style={{ fontSize:"13px", color:C.muted, lineHeight:"1.8", margin:0 }}>
              Toutes tes données sont sauvegardées en temps réel sur <strong style={{ color:C.green }}>Supabase</strong> — un serveur sécurisé en Europe. 🇪🇺<br/>
              Accessible depuis <strong style={{ color:C.text }}>n'importe quel appareil</strong> — tablette, téléphone, ordi. Jamais perdues. ✅
            </p>
          </div>
        </>}

        {/* CLIENTS */}
        {tab==="clients" && <>
          <div style={S.sec}>
            <div style={S.stitle}>➕ Ajouter un client</div>
            <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
              <input style={{ ...S.input, flex:1, minWidth:"140px" }} placeholder="Nom complet *" value={newCust.name} onChange={e => setNewCust(p => ({...p, name:e.target.value}))} />
              <input style={{ ...S.input, flex:1, minWidth:"160px" }} placeholder="Email *" value={newCust.email} onChange={e => setNewCust(p => ({...p, email:e.target.value}))} />
              <input style={{ ...S.input, flex:1, minWidth:"130px" }} placeholder="Téléphone" value={newCust.phone} onChange={e => setNewCust(p => ({...p, phone:e.target.value}))} />
              <button style={S.btn(C.green)} onClick={addCustomer}>Ajouter</button>
            </div>
            {addMsg && <div style={S.msg(addMsg.type)}>{addMsg.text}</div>}
          </div>

          <div style={{ ...S.sec, padding:"12px 18px" }}>
            <input style={S.input} placeholder="🔍 Rechercher par nom, email ou téléphone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            {searchQuery && <div style={{ fontSize:"12px", color:C.muted, marginTop:"6px" }}>{filteredCustomers.length} résultat(s)</div>}
          </div>

          {filteredCustomers.length === 0 && <div style={{ textAlign:"center", color:C.muted, padding:"40px" }}>Aucun client trouvé 🔍</div>}

          {filteredCustomers.map(c => {
            const tier = getTier(c.cagnotte), next = TIERS[TIERS.indexOf(tier)+1];
            const pct = next ? ((c.cagnotte-tier.min)/(next.min-tier.min))*100 : 100;
            const open = expandedId === c.id;
            return <div key={c.id}>
              <div style={S.row(open)} onClick={() => setExpandedId(open ? null : c.id)}>
                <div style={{ width:"38px", height:"38px", borderRadius:"50%", background:tier.color+"33", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", flexShrink:0 }}>{tier.emoji}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:"bold", fontSize:"13px" }}>{c.name}</div>
                  <div style={{ fontSize:"10px", color:C.muted }}>{c.email}{c.phone?" · "+c.phone:""} · {c.purchases} achats</div>
                  <div style={{ display:"flex", alignItems:"center", gap:"6px", marginTop:"4px" }}>
                    <div style={{ flex:1, background:"#ffffff15", borderRadius:"4px", height:"4px" }}>
                      <div style={{ height:"4px", borderRadius:"4px", background:`linear-gradient(90deg,${tier.color},${tier.color}88)`, width:`${Math.min(pct,100)}%`, transition:"width .5s" }} />
                    </div>
                    {next && <div style={{ fontSize:"9px", color:C.muted, flexShrink:0 }}>{fmt(next.min-c.cagnotte)}€→{next.emoji}</div>}
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0, marginRight:"4px" }}>
                  <div style={{ fontWeight:"bold", color:tier.color, fontSize:"14px" }}>{fmt(c.cagnotte)}€</div>
                  <span style={S.badge(tier.color)}>{tier.name}</span>
                </div>
                <div style={{ fontSize:"11px", color:C.muted }}>{open?"▲":"▼"}</div>
              </div>

              {open && <div style={S.card(tier.color)}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"14px", flexWrap:"wrap" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:"9px", color:tier.color, letterSpacing:"2px", textTransform:"uppercase" }}>Munchys Candy — Carte de Fidélité</div>
                    <div style={{ fontSize:"18px", fontWeight:"bold", marginTop:"6px" }}>{c.name}</div>
                    <div style={{ fontSize:"10px", color:C.muted }}>{c.email}{c.phone?" · "+c.phone:""}</div>
                    <div style={{ fontSize:"10px", color:C.muted }}>Membre depuis {c.joinDate}</div>
                    <div style={{ display:"flex", gap:"16px", marginTop:"12px", flexWrap:"wrap" }}>
                      {[["CAGNOTTE",fmt(c.cagnotte)+"€",tier.color],["ACHATS",c.purchases,C.text],["REMISE",`-${tier.discount}%`,C.green]].map(([l,v,col]) => (
                        <div key={l}><div style={{ fontSize:"8px", color:C.muted, letterSpacing:"1px" }}>{l}</div><div style={{ fontSize:"22px", fontWeight:"bold", color:col }}>{v}</div></div>
                      ))}
                    </div>
                    <div style={{ marginTop:"10px", fontSize:"9px", color:C.muted, letterSpacing:"2px" }}>#{String(c.id).slice(-6)} · MUNCHYS CANDY CLUB</div>
                    <div style={{ display:"flex", gap:"8px", marginTop:"14px", flexWrap:"wrap" }}>
                      <button style={{ ...S.btn(C.green), fontSize:"11px", padding:"7px 12px" }} onClick={() => { setSelected(c); setTab("achat"); }}>💰 Achat</button>
                      <button style={{ ...S.btn(C.purple), fontSize:"11px", padding:"7px 12px" }} onClick={() => { setSelected(c); setTab("emails"); }}>📧 Email</button>
                      {deleteConfirm === c.id
                        ? <><button style={{ ...S.btn("#ff4444"), fontSize:"11px", padding:"7px 12px" }} onClick={() => deleteCustomer(c.id)}>Confirmer ✕</button>
                           <button style={{ ...S.btn(C.muted), fontSize:"11px", padding:"7px 12px" }} onClick={() => setDeleteConfirm(null)}>Annuler</button></>
                        : <button style={{ ...S.btn(C.muted), fontSize:"11px", padding:"7px 12px" }} onClick={() => setDeleteConfirm(c.id)}>🗑 Supprimer</button>
                      }
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"6px" }}>
                    <div style={{ background:"#fff", padding:"7px", borderRadius:"10px", boxShadow:`0 0 16px ${tier.color}44` }}>
                      <img src={qrUrl(clientQr(c.id))} alt="QR" width={140} height={140} style={{ display:"block", borderRadius:"6px" }} />
                    </div>
                    <div style={{ fontSize:"9px", color:C.muted }}>Scanner pour identifier</div>
                    <span style={S.badge(tier.color)}>{tier.emoji} {tier.name}</span>
                  </div>
                </div>
              </div>}
            </div>;
          })}
        </>}

        {/* SCANNER */}
        {tab==="scanner" && <>
          <div style={S.sec}>
            <div style={S.stitle}>📷 Scanner la Carte Client</div>
            <p style={{ color:C.muted, fontSize:"12px", marginTop:0 }}>Le client montre son QR — tu scannes, son profil s'affiche.</p>
            {!scanActive && !scanResult && (
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <div style={{ fontSize:"58px", marginBottom:"14px" }}>📷</div>
                <button style={{ ...S.btn(C.purple), fontSize:"15px", padding:"13px 32px" }} onClick={startScanner} disabled={!jsqrReady||scanLoading}>
                  {scanLoading?"⏳ Démarrage...":!jsqrReady?"⏳ Chargement...":"📷 Démarrer le scanner"}
                </button>
              </div>
            )}
            {scanError && <div style={S.msg("error")}>{scanError}</div>}
            {scanActive && <>
              <div style={{ position:"relative", borderRadius:"14px", overflow:"hidden", background:"#000", maxWidth:"440px", margin:"0 auto" }}>
                <video ref={videoRef} style={{ width:"100%", display:"block" }} playsInline muted />
                <canvas ref={canvasRef} style={{ display:"none" }} />
                <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", pointerEvents:"none" }}>
                  <div style={{ width:"190px", height:"190px", border:"3px solid "+C.pink, borderRadius:"14px", boxShadow:"0 0 0 9999px rgba(0,0,0,0.5)" }} />
                </div>
                <div style={{ position:"absolute", bottom:"12px", left:0, right:0, textAlign:"center" }}>
                  <div style={{ background:"rgba(0,0,0,.75)", color:C.text, fontSize:"11px", padding:"5px 14px", borderRadius:"20px", display:"inline-block" }}>🔍 Placez le QR dans le cadre</div>
                </div>
              </div>
              <div style={{ textAlign:"center", marginTop:"12px" }}><button style={S.btn(C.muted)} onClick={stopScanner}>✕ Annuler</button></div>
            </>}
            {scanResult && (() => {
              if (scanResult.type === "unknown") return <div style={S.msg("error")}>QR non reconnu.</div>;
              const c = customers.find(x => x.id === scanResult.customer.id) || scanResult.customer;
              const tier = getTier(c.cagnotte);
              return <div>
                <div style={{ background:"#00E67622", border:`2px solid ${C.green}`, borderRadius:"14px", padding:"18px", marginBottom:"12px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"10px" }}>
                    <div style={{ fontSize:"38px" }}>{tier.emoji}</div>
                    <div style={{ flex:1 }}><div style={{ fontSize:"10px", color:C.green, letterSpacing:"1px" }}>✅ CLIENT IDENTIFIÉ</div><div style={{ fontSize:"18px", fontWeight:"bold" }}>{c.name}</div><div style={{ fontSize:"11px", color:C.muted }}>{c.email}</div></div>
                    <div style={{ textAlign:"right" }}><div style={{ fontSize:"24px", fontWeight:"bold", color:tier.color }}>{fmt(c.cagnotte)}€</div><div style={{ fontSize:"10px", color:C.muted }}>cagnotte</div></div>
                  </div>
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                    <span style={S.badge(tier.color)}>{tier.emoji} {tier.name}</span>
                    <span style={S.badge(C.blue)}>-{tier.discount}%</span>
                    <span style={S.badge(C.muted)}>{c.purchases} achats</span>
                  </div>
                </div>
                <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                  <button style={S.btn(C.green)} onClick={() => { setSelected(c); setTab("achat"); }}>💰 Achat</button>
                  <button style={S.btn(C.purple)} onClick={() => { setSelected(c); setTab("emails"); }}>📧 Email</button>
                  <button style={S.btn(C.blue)} onClick={() => { setScanResult(null); startScanner(); }}>📷 Rescanner</button>
                </div>
              </div>;
            })()}
          </div>

          <div style={S.sec}>
            <div style={S.stitle}>🔍 Recherche manuelle (sans QR)</div>
            <input style={S.input} placeholder="Nom, email ou téléphone..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            {searchQuery && filteredCustomers.map(c => {
              const tier = getTier(c.cagnotte);
              return <div key={c.id} style={{ ...S.row(selected?.id===c.id), marginTop:"8px" }} onClick={() => { setSelected(c); setSearchQuery(""); }}>
                <div style={{ fontSize:"24px" }}>{tier.emoji}</div>
                <div style={{ flex:1 }}><div style={{ fontWeight:"bold", fontSize:"13px" }}>{c.name}</div><div style={{ fontSize:"11px", color:C.muted }}>{c.email}{c.phone?" · "+c.phone:""}</div></div>
                <div style={{ textAlign:"right" }}><div style={{ fontWeight:"bold", color:tier.color }}>{fmt(c.cagnotte)}€</div><span style={S.badge(tier.color)}>{tier.name}</span></div>
              </div>;
            })}
            {selected && !searchQuery && (
              <div style={{ background:"#00E67622", border:`1px solid ${C.green}44`, borderRadius:"12px", padding:"12px", marginTop:"10px", display:"flex", alignItems:"center", gap:"10px" }}>
                <span style={{ fontSize:"24px" }}>{getTier(selected.cagnotte).emoji}</span>
                <div style={{ flex:1 }}><div style={{ fontWeight:"bold" }}>{selected.name}</div><div style={{ fontSize:"11px", color:C.muted }}>{selected.email}</div></div>
                <div style={{ display:"flex", gap:"8px" }}>
                  <button style={{ ...S.btn(C.green), fontSize:"11px", padding:"7px 12px" }} onClick={() => setTab("achat")}>💰 Achat</button>
                  <button style={{ ...S.btn(C.muted), fontSize:"11px", padding:"7px 12px" }} onClick={() => setSelected(null)}>✕</button>
                </div>
              </div>
            )}
          </div>
        </>}

        {/* ACHAT */}
        {tab==="achat" && <>
          <div style={S.sec}>
            <div style={S.stitle}>👤 Sélectionner un client</div>
            <p style={{ color:C.muted, fontSize:"12px", marginTop:0 }}>Ou utilise <button style={{ background:"none", border:"none", color:C.purple, cursor:"pointer", fontWeight:"bold", fontSize:"12px", padding:0 }} onClick={() => setTab("scanner")}>📷 le scanner QR</button></p>
            <CustomerPicker onPick={setSelected} current={selected} />
          </div>

          {selected && <>
            <div style={S.sec}>
              <div style={S.stitle}>💰 Enregistrer un achat — {selected.name}</div>
              <div style={{ background:C.cardLight, borderRadius:"10px", padding:"10px 14px", marginBottom:"12px", fontSize:"12px" }}>
                💡 Le client gagne <strong style={{ color:C.green }}>5%</strong> du montant · Cagnotte actuelle : <strong style={{ color:getTier(selected.cagnotte).color }}>{fmt(selected.cagnotte)}€</strong>
              </div>
              <div style={{ display:"flex", gap:"10px" }}>
                <input style={{ ...S.input, flex:1 }} type="number" placeholder="Montant de l'achat (€)" value={purchaseAmt} onChange={e => setPurchaseAmt(e.target.value)} />
                <button style={S.btn(C.green)} onClick={addPurchase}>Valider</button>
              </div>
              {purchaseAmt && parseFloat(purchaseAmt) >= 1 && (
                <div style={{ fontSize:"12px", color:C.yellow, marginTop:"8px" }}>✨ +<strong style={{ color:C.green }}>{fmt(parseFloat(purchaseAmt)*0.05)}€</strong> en cagnotte</div>
              )}
              {purchaseMsg && <div style={S.msg(purchaseMsg.type)}>{purchaseMsg.text}</div>}
            </div>

            <div style={{ ...S.sec, background:"#9B51E008", border:"1px solid #9B51E033" }}>
              <div style={S.stitle}>🎁 Utiliser la Cagnotte — {selected.name}</div>
              <div style={{ background:C.cardLight, borderRadius:"10px", padding:"10px 14px", marginBottom:"12px", fontSize:"13px", display:"flex", alignItems:"center", gap:"10px" }}>
                <span style={{ fontSize:"24px" }}>{getTier(selected.cagnotte).emoji}</span>
                <div><div style={{ color:C.muted, fontSize:"11px" }}>Cagnotte disponible</div><div style={{ fontSize:"22px", fontWeight:"bold", color:getTier(selected.cagnotte).color }}>{fmt(selected.cagnotte)}€</div></div>
              </div>
              <div style={{ display:"flex", gap:"10px" }}>
                <input style={{ ...S.input, flex:1 }} type="number" placeholder={`Max ${fmt(selected.cagnotte)}€`} value={useAmt} onChange={e => setUseAmt(e.target.value)} />
                <button style={S.btn(C.purple)} onClick={useCagnotte}>Utiliser</button>
              </div>
              {useAmt && parseFloat(useAmt) > 0 && parseFloat(useAmt) <= selected.cagnotte && (
                <div style={{ fontSize:"12px", color:C.yellow, marginTop:"8px" }}>💡 Reste après : <strong style={{ color:C.green }}>{fmt(selected.cagnotte - parseFloat(useAmt))}€</strong></div>
              )}
              {useMsg && <div style={S.msg(useMsg.type)}>{useMsg.text}</div>}
              <div style={{ display:"flex", gap:"8px", marginTop:"10px", flexWrap:"wrap" }}>
                <div style={{ fontSize:"11px", color:C.muted, width:"100%" }}>Montants rapides :</div>
                {[1,2,5,10].filter(a => selected.cagnotte >= a).map(a => (
                  <button key={a} style={{ ...S.btn(C.cardLight), fontSize:"11px", padding:"6px 12px", border:"1px solid #ffffff20" }} onClick={() => setUseAmt(String(a))}>{a}€</button>
                ))}
                {selected.cagnotte > 0 && <button style={{ ...S.btn(C.cardLight), fontSize:"11px", padding:"6px 12px", border:"1px solid #ffffff20" }} onClick={() => setUseAmt(fmt(selected.cagnotte))}>Tout ({fmt(selected.cagnotte)}€)</button>}
              </div>
            </div>
          </>}

          <div style={S.sec}>
            <div style={S.stitle}>📊 Simulateur — 5% en Cagnotte</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(85px,1fr))", gap:"8px" }}>
              {[1,5,10,20,50,100].map(a => (
                <div key={a} style={{ background:C.cardLight, borderRadius:"10px", padding:"10px", textAlign:"center" }}>
                  <div style={{ fontSize:"15px", fontWeight:"bold", color:C.yellow }}>{a}€</div>
                  <div style={{ fontSize:"10px", color:C.muted }}>→ 5%</div>
                  <div style={{ fontSize:"14px", fontWeight:"bold", color:C.green }}>{fmt(a*0.05)}€</div>
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* DÉ */}
        {tab==="de" && <div style={{ ...S.sec, textAlign:"center" }}>
          <div style={S.stitle}>🎲 Jeu du Dé — Panier Gratuit !</div>
          <p style={{ color:C.muted, fontSize:"12px" }}>Un <strong style={{ color:C.yellow }}>6</strong> = panier <strong style={{ color:C.green }}>100% GRATUIT</strong> !</p>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:"14px" }}>
            <input style={{ ...S.input, width:"200px" }} placeholder="Montant du panier (€)" value={cartAmt} onChange={e => setCartAmt(e.target.value)} />
          </div>
          <div style={{ fontSize:"88px", cursor:"pointer", userSelect:"none", filter:diceRolling?"blur(1px)":"none" }} onClick={rollDice}>
            {diceResult ? DICE_FACES[diceResult] : "🎲"}
          </div>
          <button style={{ ...S.btn(diceRolling?C.muted:C.purple), fontSize:"15px", padding:"12px 28px", margin:"10px 0" }} onClick={rollDice} disabled={diceRolling}>
            {diceRolling ? "⏳ En cours..." : "🎲 Lancer le dé !"}
          </button>
          {diceResult && !diceRolling && (diceWon
            ? <div style={{ background:"#00E67622", border:`2px solid ${C.green}`, borderRadius:"14px", padding:"20px" }}>
                <div style={{ fontSize:"40px" }}>🎉</div>
                <div style={{ fontSize:"20px", fontWeight:"bold", color:C.green }}>FÉLICITATIONS !</div>
                {cartAmt && <div style={{ fontSize:"18px", fontWeight:"bold", color:C.green, marginTop:"6px" }}>🎁 {cartAmt}€ → GRATUIT !</div>}
              </div>
            : <div style={{ background:"#FF3D7F11", border:"1px solid #FF3D7F44", borderRadius:"14px", padding:"16px" }}>
                <div style={{ fontSize:"32px" }}>{DICE_FACES[diceResult]}</div>
                <div style={{ fontSize:"15px", color:C.pink, fontWeight:"bold" }}>Résultat : {diceResult}</div>
                <div style={{ fontSize:"11px", color:C.muted, marginTop:"5px" }}>Pas de 6 cette fois… à la prochaine ! 🍬</div>
              </div>
          )}
        </div>}

        {/* EMAILS */}
        {tab==="emails" && <>
          <div style={{ display:"flex", gap:"8px", marginBottom:"16px", flexWrap:"wrap" }}>
            <button style={{ ...S.btn(!groupTpl?C.pink:C.cardLight), fontSize:"13px" }} onClick={() => setGroupTpl(null)}>👤 Email individuel</button>
            <button style={{ ...S.btn(groupTpl?C.pink:C.cardLight), fontSize:"13px" }} onClick={() => setGroupTpl("pending")}>📢 Email groupé</button>
          </div>

          {!groupTpl && <>
            <div style={S.sec}><div style={S.stitle}>👤 Sélectionner un client</div><CustomerPicker onPick={setSelected} current={selected} /></div>
            {selected && <>
              <div style={S.sec}>
                <div style={S.stitle}>📧 Templates d'Email</div>
                <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"8px" }}>
                  <button style={S.btn(C.blue)} onClick={() => generateEmail("welcome")}>🎉 Bienvenue</button>
                  <button style={S.btn(C.purple)} onClick={() => generateEmail("promo")}>🎁 Code Promo</button>
                  <button style={S.btn(C.pink)} onClick={() => generateEmail("birthday")}>🎂 Anniversaire</button>
                </div>
                <div style={{ borderTop:"1px solid #ffffff15", paddingTop:"10px" }}>
                  <div style={{ fontSize:"12px", color:C.yellow, marginBottom:"8px", fontWeight:"bold" }}>🏷 Offres du Moment</div>
                  <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                    <button style={S.btn("#22AA66")} onClick={() => generateEmail("offre5")}>🍬 -5%</button>
                    <button style={S.btn("#DD8800")} onClick={() => generateEmail("offre10")}>🍭 -10%</button>
                    <button style={S.btn(C.purple)} onClick={() => generateEmail("offre15")}>👑 -15% VIP</button>
                  </div>
                </div>
                {emailTpl && <>
                  <div style={{ fontWeight:"bold", fontSize:"12px", marginTop:"14px", color:C.yellow }}>📩 Objet : {emailTpl.subject}</div>
                  <div style={{ background:C.cardLight, borderRadius:"10px", padding:"12px", fontSize:"12px", lineHeight:"1.8", whiteSpace:"pre-wrap", border:"1px solid #ffffff15", marginTop:"6px" }}>{emailTpl.body}</div>
                  <div style={{ display:"flex", gap:"8px", marginTop:"8px", flexWrap:"wrap" }}>
                    <button style={{ ...S.btn(C.muted), fontSize:"11px" }} onClick={() => navigator.clipboard?.writeText(`Objet: ${emailTpl.subject}\n\n${emailTpl.body}`)}>📋 Copier</button>
                    <button style={{ ...S.btn(sendingId===selected?.id?C.muted:C.green), fontSize:"11px" }}
                      disabled={sendingId===selected?.id}
                      onClick={() => sendEmail(selected.email, emailTpl.subject, emailTpl.body, selected.id)}>
                      {sendingId===selected?.id ? "⏳ Envoi..." : "📧 Envoyer à "+selected.name.split(" ")[0]}
                    </button>
                  </div>
                  {sendMsg && <div style={S.msg(sendMsg.type)}>{sendMsg.text}</div>}
                </>}
              </div>
              <div style={S.sec}>
                <div style={S.stitle}>🎟 Code Promo</div>
                <button style={S.btn(C.yellow)} onClick={() => { const tier=getTier(selected.cagnotte); setPromoCode({ code:genCode(), discount:tier.discount, tier:tier.name }); }}>✨ Générer</button>
                {promoCode && <div style={{ marginTop:"12px", background:C.yellow+"15", border:`2px dashed ${C.yellow}`, borderRadius:"12px", padding:"16px", textAlign:"center" }}>
                  <div style={{ fontSize:"10px", color:C.muted, letterSpacing:"2px" }}>CODE PROMO</div>
                  <div style={{ fontSize:"24px", fontWeight:"bold", color:C.yellow, letterSpacing:"4px", margin:"6px 0" }}>{promoCode.code}</div>
                  <div style={{ color:C.green, fontWeight:"bold", fontSize:"13px" }}>-{promoCode.discount}% · {promoCode.tier}</div>
                </div>}
              </div>
            </>}
            {!selected && <div style={{ textAlign:"center", color:C.muted, padding:"36px" }}>Sélectionne un client pour continuer</div>}
          </>}

          {groupTpl && <>
            <div style={S.sec}>
              <div style={S.stitle}>📢 Template groupé</div>
              <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"8px" }}>
                <button style={S.btn("#22AA66")} onClick={() => generateGroupEmail("offre5")}>🍬 -5% à tous</button>
                <button style={S.btn("#DD8800")} onClick={() => generateGroupEmail("offre10")}>🍭 -10% à tous</button>
                <button style={S.btn(C.purple)} onClick={() => generateGroupEmail("offre15")}>👑 -15% à tous</button>
                <button style={S.btn(C.blue)} onClick={() => generateGroupEmail("promo")}>🎁 Promo perso</button>
              </div>
            </div>

            {groupTpl && groupTpl !== "pending" && (
              <div style={S.sec}>
                <div style={S.stitle}>📬 Emails à envoyer — {customers.length} clients</div>
                <div style={{ fontSize:"12px", color:C.muted, marginBottom:"12px" }}>Copie chaque email et envoie depuis ta boîte mail.</div>
                {customers.map(c => {
                  const tier = getTier(c.cagnotte);
                  const body = typeof groupTpl.body === "function" ? groupTpl.body(c.name.split(" ")[0], tier) : groupTpl.body;
                  const full = `Objet: ${groupTpl.subject}\n\n${body}`;
                  return <div key={c.id} style={{ background:C.cardLight, borderRadius:"12px", padding:"12px", marginBottom:"8px", border:"1px solid #ffffff10" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"6px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                        <span style={{ fontSize:"18px" }}>{tier.emoji}</span>
                        <div><div style={{ fontWeight:"bold", fontSize:"12px" }}>{c.name}</div><div style={{ fontSize:"10px", color:C.muted }}>{c.email}</div></div>
                      </div>
                      <div style={{ display:"flex", gap:"6px" }}>
                        <button style={{ ...S.btn(copiedId===c.id?C.green:C.cardLight), fontSize:"10px", padding:"5px 10px", border:`1px solid #ffffff20` }} onClick={() => copyEmail(full, c.id)}>
                          {copiedId===c.id?"✅":"📋"}
                        </button>
                        <button style={{ ...S.btn(sendingId===c.id?C.muted:C.green), fontSize:"10px", padding:"5px 10px" }}
                          disabled={sendingId===c.id}
                          onClick={() => sendEmail(c.email, groupTpl.subject, body, c.id)}>
                          {sendingId===c.id?"⏳":"📧 Envoyer"}
                        </button>
                      </div>
                    </div>
                  </div>;
                })}
                {sendMsg && <div style={S.msg(sendMsg.type)}>{sendMsg.text}</div>}
              </div>
            )}
          </>}
        </>}

      </div>
    </div>
  );
}
