import { useState, useEffect, useRef, useCallback } from "react";

const C = {
  pink: "#FF3D7F", yellow: "#FFD600", blue: "#00C2FF",
  purple: "#9B51E0", green: "#00E676", bg: "#0D0D1A",
  card: "#16162A", cardLight: "#1E1E35", text: "#FFFFFF", muted: "#8888AA",
};
const TIERS = [
  { name:"Sucre",     min:0,    max:199,      color:"#C0C0C0", emoji:"🍬", discount:5  },
  { name:"Caramel",   min:200,  max:499,      color:"#FFD600", emoji:"🍭", discount:10 },
  { name:"Chocolat",  min:500,  max:999,      color:"#CD7F32", emoji:"🍫", discount:15 },
  { name:"Candy VIP", min:1000, max:Infinity, color:"#FF3D7F", emoji:"👑", discount:20 },
];
const MIN_PURCHASE   = 5;
const STORAGE_KEY    = "munchys-customers";
const DICE_FACES     = ["","⚀","⚁","⚂","⚃","⚄","⚅"];
const DEMO_CUSTOMERS = [
  { id:1001, name:"Sophie Martin", email:"sophie@email.com", points:340,  joinDate:"2024-01-15", purchases:12 },
  { id:1002, name:"Lucas Dupont",  email:"lucas@email.com",  points:85,   joinDate:"2024-03-20", purchases:4  },
  { id:1003, name:"Emma Leroy",    email:"emma@email.com",   points:1120, joinDate:"2023-11-01", purchases:38 },
];

const getTier  = p   => TIERS.find(t => p >= t.min && p <= t.max) || TIERS[0];
const genCode  = pfx => (pfx||"MUNCHY") + "-" + Math.random().toString(36).substring(2,8).toUpperCase();
const qrUrl    = (data,sz=160) => `https://api.qrserver.com/v1/create-qr-code/?size=${sz}x${sz}&data=${encodeURIComponent(data)}&format=png`;
const clientQr = id  => `MUNCHY-CLIENT-${id}`;
const today    = ()  => new Date().toISOString().split("T")[0];
const newId    = ()  => 1000 + Math.floor(Math.random() * 8999);

// ── Sauvegarde localStorage ──────────────────────────────────────────────────
function loadCustomers() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      return data.length > 0 ? data : DEMO_CUSTOMERS;
    }
  } catch {}
  return DEMO_CUSTOMERS;
}

function saveCustomers(customers) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(customers)); } catch {}
}

export default function MunchysLoyalty() {
  const [customers,     setCustomersRaw]  = useState(() => loadCustomers());
  const [saveStatus,    setSaveStatus]    = useState("saved");
  const [tab,           setTab]           = useState("dashboard");
  const [expandedId,    setExpandedId]    = useState(null);
  const [selected,      setSelected]      = useState(null);
  const [purchaseAmt,   setPurchaseAmt]   = useState("");
  const [purchaseMsg,   setPurchaseMsg]   = useState(null);
  const [newCust,       setNewCust]       = useState({ name:"", email:"" });
  const [addMsg,        setAddMsg]        = useState(null);
  const [cartAmt,       setCartAmt]       = useState("");
  const [diceResult,    setDiceResult]    = useState(null);
  const [diceRolling,   setDiceRolling]   = useState(false);
  const [diceWon,       setDiceWon]       = useState(false);
  const [promoCode,     setPromoCode]     = useState(null);
  const [emailTpl,      setEmailTpl]      = useState(null);
  const [scanActive,    setScanActive]    = useState(false);
  const [scanResult,    setScanResult]    = useState(null);
  const [scanError,     setScanError]     = useState(null);
  const [scanLoading,   setScanLoading]   = useState(false);
  const [jsqrReady,     setJsqrReady]     = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const videoRef  = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const rafRef    = useRef(null);

  // Wrapper qui sauvegarde à chaque modification
  function setCustomers(updater) {
    setCustomersRaw(prev => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      setSaveStatus("saving");
      saveCustomers(next);
      setTimeout(() => setSaveStatus("saved"), 600);
      return next;
    });
  }

  // jsQR
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
    streamRef.current = null;
    setScanActive(false);
  }

  const scanFrame = useCallback(() => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || !window.jsQR) return;
    const ctx = canvas.getContext("2d");
    if (video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth; canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const img  = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts:"dontInvert" });
      if (code?.data?.startsWith("MUNCHY-CLIENT-")) {
        const id    = parseInt(code.data.replace("MUNCHY-CLIENT-",""), 10);
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
      setScanError("Accès caméra refusé. Autorise la caméra dans les paramètres de ton navigateur.");
    }
  }

  function addPurchase() {
    const amount = parseFloat(purchaseAmt);
    if (!selected)                         return setPurchaseMsg({ type:"error", text:"Sélectionne un client." });
    if (isNaN(amount)||amount<MIN_PURCHASE) return setPurchaseMsg({ type:"error", text:`Minimum ${MIN_PURCHASE}€ pour gagner des points.` });
    const earned  = Math.floor(amount);
    const updated = { ...selected, points:selected.points+earned, purchases:selected.purchases+1 };
    setCustomers(prev => prev.map(c => c.id===selected.id ? updated : c));
    setSelected(updated);
    setPurchaseMsg({ type:"success", text:`✅ +${earned} points pour ${amount}€ — sauvegardé !` });
    setPurchaseAmt("");
    setTimeout(() => setPurchaseMsg(null), 4000);
  }

  function rollDice() {
    if (diceRolling) return;
    setDiceRolling(true); setDiceResult(null); setDiceWon(false);
    let count=0, r=1;
    const iv = setInterval(() => {
      r = Math.floor(Math.random()*6)+1; setDiceResult(r); count++;
      if (count>=14) { clearInterval(iv); setDiceRolling(false); if(r===6) setDiceWon(true); }
    }, 80);
  }

  function addCustomer() {
    if (!newCust.name||!newCust.email) return setAddMsg({ type:"error", text:"Remplis le nom et l'email." });
    if (customers.some(c=>c.email.toLowerCase()===newCust.email.toLowerCase()))
      return setAddMsg({ type:"error", text:"Cet email existe déjà." });
    const c = { id:newId(), name:newCust.name.trim(), email:newCust.email.trim(), points:0, joinDate:today(), purchases:0 };
    setCustomers(prev => [...prev, c]);
    setNewCust({ name:"", email:"" });
    setAddMsg({ type:"success", text:"Client ajouté et sauvegardé ! 🎉" });
    setTimeout(() => setAddMsg(null), 4000);
  }

  function deleteCustomer(id) {
    setCustomers(prev => prev.filter(c => c.id!==id));
    if (selected?.id===id) setSelected(null);
    setExpandedId(null); setDeleteConfirm(null);
  }

  function generateEmail(type) {
    if (!selected) return;
    const tier=getTier(selected.points), first=selected.name.split(" ")[0], code=genCode("CANDY");
    const tpls = {
      welcome:  { subject:`Bienvenue chez Munchys Candy, ${first} ! 🍬`,  body:`Bonjour ${first},\n\nMerci d'avoir rejoint le programme de fidélité Munchys Candy !\n\nTon code de bienvenue : ${code}\n✅ -5% sur ta prochaine commande\n\nÀ très bientôt ! 🍭\n\nL'équipe Munchys Candy` },
      promo:    { subject:`Un cadeau spécial pour toi, ${first} ! 🎁`,    body:`Bonjour ${first},\n\nTu es un(e) client(e) ${tier.emoji} ${tier.name} — voici ta surprise !\n\nCode promo : ${code}\n✅ -${tier.discount}% sur tous les bonbons\n⏳ Valable 30 jours\n\nL'équipe Munchys Candy` },
      birthday: { subject:`Joyeux anniversaire de Munchys ! 🎂`,          body:`Bonjour ${first},\n\nToute l'équipe te souhaite un joyeux anniversaire ! 🎉\n\nCode anniversaire : ${code}\n🎁 -15% sur toute ta commande\n⏳ Valable jusqu'à la fin du mois\n\nBisous sucrés,\nL'équipe Munchys Candy` },
    };
    setEmailTpl(tpls[type]);
  }

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
    loyCard:c => ({ background:`linear-gradient(135deg,${c}44,${c}11)`, border:`2px solid ${c}88`, borderRadius:"20px", padding:"20px", marginBottom:"10px", marginTop:"-4px" }),
    stat:c  => ({ background:`linear-gradient(135deg,${c}22,${c}05)`, border:`1px solid ${c}44`, borderRadius:"14px", padding:"16px" }),
  };

  const totalPts  = customers.reduce((a,c)=>a+c.points,0);
  const topClient = [...customers].sort((a,b)=>b.points-a.points)[0];

  const CustomerPicker = ({ onPick, current }) => (
    <div style={{ display:"flex", flexWrap:"wrap", gap:"8px" }}>
      {customers.map(c => {
        const tier=getTier(c.points), sel=current?.id===c.id;
        return <div key={c.id} onClick={()=>onPick(c)} style={{ display:"flex", alignItems:"center", gap:"8px", padding:"8px 14px", borderRadius:"10px", cursor:"pointer", background:sel?"#FF3D7F22":"transparent", border:sel?`1px solid ${tier.color}`:"1px solid #ffffff20", transition:"all .2s" }}>
          <span>{tier.emoji}</span><span style={{ fontSize:"13px" }}>{c.name}</span><span style={{ fontSize:"11px", color:tier.color }}>{c.points}pts</span>
        </div>;
      })}
    </div>
  );

  return (
    <div style={S.app}>

      {/* Header */}
      <div style={S.header}>
        <div style={{ fontSize:"34px" }}>🍬</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:"22px", fontWeight:"bold", letterSpacing:"2px" }}>MUNCHYS CANDY</div>
          <div style={{ fontSize:"11px", opacity:.8 }}>Programme de Fidélité</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:"11px", padding:"4px 10px", borderRadius:"20px", background:saveStatus==="saved"?"#00E67622":"#FFD60022", color:saveStatus==="saved"?C.green:C.yellow, border:`1px solid ${saveStatus==="saved"?C.green:C.yellow}44` }}>
            {saveStatus==="saved" ? "✅ Sauvegardé" : "⏳ Sauvegarde..."}
          </div>
          <div style={{ fontSize:"11px", color:"#fff8", marginTop:"4px" }}>{customers.length} clients</div>
        </div>
      </div>

      {/* Tabs */}
      <div style={S.tabs}>
        {[["dashboard","📊 Dashboard"],["clients","👥 Clients"],["scanner","📷 Scanner QR"],["achat","💰 Achat"],["de","🎲 Dé"],["emails","📧 Emails"]].map(([id,lbl])=>(
          <button key={id} style={S.tab(tab===id)} onClick={()=>setTab(id)}>{lbl}</button>
        ))}
      </div>

      <div style={S.body}>

        {/* DASHBOARD */}
        {tab==="dashboard" && <>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:"12px", marginBottom:"18px" }}>
            {[[C.pink,"Total Clients",customers.length,"inscrits"],[C.yellow,"Points Distribués",totalPts.toLocaleString(),"au total"],[C.blue,"Top Client",topClient?.name.split(" ")[0]||"-",`${topClient?.points||0} pts`],[C.purple,"Achat Minimum",`${MIN_PURCHASE}€`,"1 pt par euro"]].map(([c,l,v,s])=>(
              <div key={l} style={S.stat(c)}>
                <div style={{ fontSize:"10px", color:C.muted, textTransform:"uppercase", letterSpacing:"1px" }}>{l}</div>
                <div style={{ fontSize:"26px", fontWeight:"bold", color:c, margin:"4px 0" }}>{v}</div>
                <div style={{ fontSize:"11px", color:C.muted }}>{s}</div>
              </div>
            ))}
          </div>
          <div style={S.sec}>
            <div style={S.stitle}>🏆 Niveaux</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:"8px" }}>
              {TIERS.map(tier=>{
                const n=customers.filter(c=>c.points>=tier.min&&c.points<=tier.max).length;
                return <div key={tier.name} style={{ background:tier.color+"15", border:`1px solid ${tier.color}44`, borderRadius:"12px", padding:"12px", textAlign:"center" }}>
                  <div style={{ fontSize:"22px" }}>{tier.emoji}</div>
                  <div style={{ fontWeight:"bold", color:tier.color, fontSize:"12px" }}>{tier.name}</div>
                  <div style={{ fontSize:"10px", color:C.muted, margin:"2px 0" }}>{tier.min}–{tier.max===Infinity?"∞":tier.max} pts</div>
                  <div style={{ fontSize:"16px", fontWeight:"bold" }}>{n} <span style={{ fontSize:"10px", color:C.muted }}>clients</span></div>
                  <div style={{ fontSize:"11px", color:tier.color }}>-{tier.discount}%</div>
                </div>;
              })}
            </div>
          </div>
          <div style={{ ...S.sec, background:"#00E67608", border:"1px solid #00E67633" }}>
            <div style={S.stitle}>🔒 Sauvegarde Automatique</div>
            <p style={{ fontSize:"13px", color:C.muted, lineHeight:"1.8", margin:0 }}>
              Toutes tes données sont <strong style={{ color:C.green }}>sauvegardées automatiquement</strong> sur cet appareil à chaque modification. Ferme la page, redémarre — <strong style={{ color:C.text }}>tout est conservé</strong>. ✅
            </p>
          </div>
        </>}

        {/* CLIENTS */}
        {tab==="clients" && <>
          <div style={S.sec}>
            <div style={S.stitle}>➕ Ajouter un client</div>
            <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
              <input style={{ ...S.input, flex:1, minWidth:"150px" }} placeholder="Nom complet" value={newCust.name} onChange={e=>setNewCust(p=>({...p,name:e.target.value}))} />
              <input style={{ ...S.input, flex:1, minWidth:"180px" }} placeholder="Email" value={newCust.email} onChange={e=>setNewCust(p=>({...p,email:e.target.value}))} />
              <button style={S.btn(C.green)} onClick={addCustomer}>Ajouter</button>
            </div>
            {addMsg && <div style={S.msg(addMsg.type)}>{addMsg.text}</div>}
          </div>
          {customers.length===0&&<div style={{ textAlign:"center", color:C.muted, padding:"40px" }}>Aucun client. Ajoutes-en un ! 🍬</div>}
          {customers.map(c=>{
            const tier=getTier(c.points), next=TIERS[TIERS.indexOf(tier)+1];
            const pct=next?((c.points-tier.min)/(next.min-tier.min))*100:100;
            const open=expandedId===c.id;
            return <div key={c.id}>
              <div style={S.row(open)} onClick={()=>setExpandedId(open?null:c.id)}>
                <div style={{ width:"38px", height:"38px", borderRadius:"50%", background:tier.color+"33", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", flexShrink:0 }}>{tier.emoji}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:"bold", fontSize:"13px" }}>{c.name}</div>
                  <div style={{ fontSize:"10px", color:C.muted }}>{c.email} · {c.purchases} achats</div>
                  <div style={{ display:"flex", alignItems:"center", gap:"6px", marginTop:"4px" }}>
                    <div style={{ flex:1, background:"#ffffff15", borderRadius:"4px", height:"4px" }}>
                      <div style={{ height:"4px", borderRadius:"4px", background:`linear-gradient(90deg,${tier.color},${tier.color}88)`, width:`${Math.min(pct,100)}%`, transition:"width .5s" }} />
                    </div>
                    {next&&<div style={{ fontSize:"9px", color:C.muted, flexShrink:0 }}>{next.min-c.points}pts→{next.emoji}</div>}
                  </div>
                </div>
                <div style={{ textAlign:"right", flexShrink:0, marginRight:"4px" }}>
                  <div style={{ fontWeight:"bold", color:tier.color, fontSize:"14px" }}>{c.points} pts</div>
                  <span style={S.badge(tier.color)}>{tier.name}</span>
                </div>
                <div style={{ fontSize:"11px", color:C.muted }}>{open?"▲":"▼"}</div>
              </div>
              {open && <div style={S.loyCard(tier.color)}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:"14px", flexWrap:"wrap" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:"9px", color:tier.color, letterSpacing:"2px", textTransform:"uppercase" }}>Munchys Candy — Carte de Fidélité</div>
                    <div style={{ fontSize:"18px", fontWeight:"bold", marginTop:"6px" }}>{c.name}</div>
                    <div style={{ fontSize:"10px", color:C.muted }}>Membre depuis {c.joinDate}</div>
                    <div style={{ display:"flex", gap:"16px", marginTop:"12px", flexWrap:"wrap" }}>
                      {[["POINTS",c.points,tier.color],["ACHATS",c.purchases,C.text],["REMISE",`-${tier.discount}%`,C.green]].map(([l,v,col])=>(
                        <div key={l}><div style={{ fontSize:"8px", color:C.muted, letterSpacing:"1px" }}>{l}</div><div style={{ fontSize:"22px", fontWeight:"bold", color:col }}>{v}</div></div>
                      ))}
                    </div>
                    <div style={{ marginTop:"10px", fontSize:"9px", color:C.muted, letterSpacing:"2px" }}>#{String(c.id).padStart(6,"0")} · MUNCHYS CANDY CLUB</div>
                    <div style={{ display:"flex", gap:"8px", marginTop:"14px", flexWrap:"wrap" }}>
                      <button style={{ ...S.btn(C.green), fontSize:"11px", padding:"7px 12px" }} onClick={()=>{setSelected(c);setTab("achat");}}>💰 Achat</button>
                      <button style={{ ...S.btn(C.purple), fontSize:"11px", padding:"7px 12px" }} onClick={()=>{setSelected(c);setTab("emails");}}>📧 Email</button>
                      {deleteConfirm===c.id
                        ? <><button style={{ ...S.btn("#ff4444"), fontSize:"11px", padding:"7px 12px" }} onClick={()=>deleteCustomer(c.id)}>Confirmer ✕</button>
                           <button style={{ ...S.btn(C.muted), fontSize:"11px", padding:"7px 12px" }} onClick={()=>setDeleteConfirm(null)}>Annuler</button></>
                        : <button style={{ ...S.btn(C.muted), fontSize:"11px", padding:"7px 12px" }} onClick={()=>setDeleteConfirm(c.id)}>🗑 Supprimer</button>
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
            {!scanActive&&!scanResult&&(
              <div style={{ textAlign:"center", padding:"20px 0" }}>
                <div style={{ fontSize:"58px", marginBottom:"14px" }}>📷</div>
                <button style={{ ...S.btn(C.purple), fontSize:"15px", padding:"13px 32px" }} onClick={startScanner} disabled={!jsqrReady||scanLoading}>
                  {scanLoading?"⏳ Démarrage...":!jsqrReady?"⏳ Chargement...":"📷 Démarrer le scanner"}
                </button>
              </div>
            )}
            {scanError&&<div style={S.msg("error")}>{scanError}</div>}
            {scanActive&&<>
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
            {scanResult&&(()=>{
              if(scanResult.type==="unknown") return <div style={S.msg("error")}>QR non reconnu — ce client n'est pas enregistré.</div>;
              const c=customers.find(x=>x.id===scanResult.customer.id)||scanResult.customer, tier=getTier(c.points);
              return <div>
                <div style={{ background:"#00E67622", border:`2px solid ${C.green}`, borderRadius:"14px", padding:"18px", marginBottom:"12px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"12px", marginBottom:"10px" }}>
                    <div style={{ fontSize:"38px" }}>{tier.emoji}</div>
                    <div style={{ flex:1 }}><div style={{ fontSize:"10px", color:C.green, letterSpacing:"1px" }}>✅ CLIENT IDENTIFIÉ</div><div style={{ fontSize:"18px", fontWeight:"bold" }}>{c.name}</div><div style={{ fontSize:"11px", color:C.muted }}>{c.email}</div></div>
                    <div style={{ textAlign:"right" }}><div style={{ fontSize:"24px", fontWeight:"bold", color:tier.color }}>{c.points}</div><div style={{ fontSize:"10px", color:C.muted }}>points</div></div>
                  </div>
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                    <span style={S.badge(tier.color)}>{tier.emoji} {tier.name}</span>
                    <span style={S.badge(C.blue)}>-{tier.discount}%</span>
                    <span style={S.badge(C.muted)}>{c.purchases} achats</span>
                  </div>
                </div>
                <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                  <button style={S.btn(C.green)} onClick={()=>{setSelected(c);setTab("achat");}}>💰 Enregistrer un achat</button>
                  <button style={S.btn(C.purple)} onClick={()=>{setSelected(c);setTab("emails");}}>📧 Email / Promo</button>
                  <button style={S.btn(C.blue)} onClick={()=>{setScanResult(null);startScanner();}}>📷 Rescanner</button>
                </div>
              </div>;
            })()}
          </div>
          {!scanActive&&!scanResult&&<div style={S.sec}>
            <div style={S.stitle}>💡 Comment ça marche ?</div>
            {[["1️⃣","Le client montre sa carte","Affichée dans Clients sur son téléphone, ou imprimée"],["2️⃣","Tu cliques Démarrer","Autorise la caméra (une seule fois)"],["3️⃣","Tu pointes la caméra","Le QR est détecté automatiquement"],["4️⃣","Profil instantané","Points, niveau, achats — tout s'affiche"]].map(([n,t,d])=>(
              <div key={t} style={{ background:C.cardLight, borderRadius:"10px", padding:"10px 12px", display:"flex", gap:"10px", marginBottom:"8px" }}>
                <span style={{ fontSize:"16px", flexShrink:0 }}>{n}</span>
                <div><div style={{ fontWeight:"bold", fontSize:"12px" }}>{t}</div><div style={{ fontSize:"11px", color:C.muted, marginTop:"1px" }}>{d}</div></div>
              </div>
            ))}
          </div>}
        </>}

        {/* ACHAT */}
        {tab==="achat" && <>
          <div style={S.sec}>
            <div style={S.stitle}>👤 Sélectionner un client</div>
            <p style={{ color:C.muted, fontSize:"12px", marginTop:0 }}>Ou utilise <button style={{ background:"none", border:"none", color:C.purple, cursor:"pointer", fontWeight:"bold", fontSize:"12px", padding:0 }} onClick={()=>setTab("scanner")}>📷 le scanner QR</button></p>
            <CustomerPicker onPick={setSelected} current={selected} />
          </div>
          {selected&&<div style={S.sec}>
            <div style={S.stitle}>💰 Enregistrer un achat — {selected.name}</div>
            <p style={{ color:C.muted, fontSize:"11px", marginTop:0 }}>Minimum {MIN_PURCHASE}€ · 1 point par euro · Sauvegarde automatique ✅</p>
            <div style={{ display:"flex", gap:"10px" }}>
              <input style={{ ...S.input, flex:1 }} type="number" placeholder={`Montant (min. ${MIN_PURCHASE}€)`} value={purchaseAmt} onChange={e=>setPurchaseAmt(e.target.value)} />
              <button style={S.btn(C.green)} onClick={addPurchase}>Valider</button>
            </div>
            {purchaseAmt&&parseFloat(purchaseAmt)>=MIN_PURCHASE&&<div style={{ fontSize:"12px", color:C.yellow, marginTop:"8px" }}>✨ +<strong>{Math.floor(parseFloat(purchaseAmt))}</strong> points</div>}
            {purchaseMsg&&<div style={S.msg(purchaseMsg.type)}>{purchaseMsg.text}</div>}
          </div>}
          <div style={S.sec}>
            <div style={S.stitle}>📊 Simulateur</div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(85px,1fr))", gap:"8px" }}>
              {[5,10,20,30,50,100].map(a=>(
                <div key={a} style={{ background:C.cardLight, borderRadius:"10px", padding:"10px", textAlign:"center" }}>
                  <div style={{ fontSize:"15px", fontWeight:"bold", color:C.yellow }}>{a}€</div>
                  <div style={{ fontSize:"10px", color:C.muted }}>→</div>
                  <div style={{ fontSize:"14px", fontWeight:"bold", color:C.pink }}>{a} pts</div>
                </div>
              ))}
            </div>
          </div>
        </>}

        {/* DÉ */}
        {tab==="de"&&<div style={{ ...S.sec, textAlign:"center" }}>
          <div style={S.stitle}>🎲 Jeu du Dé — Panier Gratuit !</div>
          <p style={{ color:C.muted, fontSize:"12px" }}>Un <strong style={{ color:C.yellow }}>6</strong> = panier <strong style={{ color:C.green }}>100% GRATUIT</strong> !</p>
          <div style={{ display:"flex", justifyContent:"center", marginBottom:"14px" }}>
            <input style={{ ...S.input, width:"200px" }} placeholder="Montant du panier (€)" value={cartAmt} onChange={e=>setCartAmt(e.target.value)} />
          </div>
          <div style={{ fontSize:"88px", cursor:"pointer", userSelect:"none", filter:diceRolling?"blur(1px)":"none" }} onClick={rollDice}>{diceResult?DICE_FACES[diceResult]:"🎲"}</div>
          <button style={{ ...S.btn(diceRolling?C.muted:C.purple), fontSize:"15px", padding:"12px 28px", margin:"10px 0" }} onClick={rollDice} disabled={diceRolling}>
            {diceRolling?"⏳ En cours...":"🎲 Lancer le dé !"}
          </button>
          {diceResult&&!diceRolling&&(diceWon
            ? <div style={{ background:"#00E67622", border:`2px solid ${C.green}`, borderRadius:"14px", padding:"20px" }}>
                <div style={{ fontSize:"40px" }}>🎉</div>
                <div style={{ fontSize:"20px", fontWeight:"bold", color:C.green }}>FÉLICITATIONS !</div>
                {cartAmt&&<div style={{ fontSize:"18px", fontWeight:"bold", color:C.green, marginTop:"6px" }}>🎁 {cartAmt}€ → GRATUIT !</div>}
              </div>
            : <div style={{ background:"#FF3D7F11", border:"1px solid #FF3D7F44", borderRadius:"14px", padding:"16px" }}>
                <div style={{ fontSize:"32px" }}>{DICE_FACES[diceResult]}</div>
                <div style={{ fontSize:"15px", color:C.pink, fontWeight:"bold" }}>Résultat : {diceResult}</div>
                <div style={{ fontSize:"11px", color:C.muted, marginTop:"5px" }}>Pas de 6 cette fois… à la prochaine visite ! 🍬</div>
              </div>
          )}
        </div>}

        {/* EMAILS */}
        {tab==="emails"&&<>
          <div style={S.sec}><div style={S.stitle}>👤 Sélectionner un client</div><CustomerPicker onPick={setSelected} current={selected} /></div>
          {selected&&<>
            <div style={S.sec}>
              <div style={S.stitle}>📧 Modèles d'Emails</div>
              <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                <button style={S.btn(C.blue)} onClick={()=>generateEmail("welcome")}>🎉 Bienvenue</button>
                <button style={S.btn(C.purple)} onClick={()=>generateEmail("promo")}>🎁 Code Promo</button>
                <button style={S.btn(C.pink)} onClick={()=>generateEmail("birthday")}>🎂 Anniversaire</button>
              </div>
              {emailTpl&&<>
                <div style={{ fontWeight:"bold", fontSize:"12px", marginTop:"12px" }}>Objet : {emailTpl.subject}</div>
                <div style={{ background:C.cardLight, borderRadius:"10px", padding:"12px", fontSize:"12px", lineHeight:"1.8", whiteSpace:"pre-wrap", border:"1px solid #ffffff15", marginTop:"6px" }}>{emailTpl.body}</div>
                <button style={{ ...S.btn(C.muted), marginTop:"8px", fontSize:"11px" }} onClick={()=>navigator.clipboard?.writeText(`Objet: ${emailTpl.subject}\n\n${emailTpl.body}`)}>📋 Copier</button>
              </>}
            </div>
            <div style={S.sec}>
              <div style={S.stitle}>🎟 Code Promo</div>
              <button style={S.btn(C.yellow)} onClick={()=>{const tier=getTier(selected.points);setPromoCode({code:genCode(),discount:tier.discount,tier:tier.name});}}>✨ Générer</button>
              {promoCode&&<div style={{ marginTop:"12px", background:C.yellow+"15", border:`2px dashed ${C.yellow}`, borderRadius:"12px", padding:"16px", textAlign:"center" }}>
                <div style={{ fontSize:"10px", color:C.muted, letterSpacing:"2px" }}>CODE PROMO</div>
                <div style={{ fontSize:"24px", fontWeight:"bold", color:C.yellow, letterSpacing:"4px", margin:"6px 0" }}>{promoCode.code}</div>
                <div style={{ color:C.green, fontWeight:"bold", fontSize:"13px" }}>-{promoCode.discount}% · {promoCode.tier}</div>
              </div>}
            </div>
            <div style={S.sec}>
              <div style={S.stitle}>📬 Outils d'envoi automatique</div>
              {[["📮 Mailchimp","Gratuit jusqu'à 500 contacts · En français"],["📧 Brevo","300 emails/jour gratuits · Interface française"],["🔁 Klaviyo","Spécialisé boutiques"]].map(([n,d])=>(
                <div key={n} style={{ background:C.cardLight, borderRadius:"10px", padding:"10px 12px", marginBottom:"7px" }}>
                  <div style={{ fontWeight:"bold", fontSize:"12px" }}>{n}</div>
                  <div style={{ fontSize:"11px", color:C.muted, marginTop:"1px" }}>{d}</div>
                </div>
              ))}
            </div>
          </>}
          {!selected&&<div style={{ textAlign:"center", color:C.muted, padding:"36px" }}>Sélectionne un client pour continuer</div>}
        </>}

      </div>
    </div>
  );
}
